// deno-lint-ignore-file no-explicit-any
import { ButtonStyle, Component } from "../../types.ts";
import * as validator from "https://deno.land/x/zod@v3.14.4/mod.ts";
import { View } from "../../lib/View.ts";
import { Horizontal, Spacer, Vertical } from "./Stacks.ts";
import { Button } from "./Button.ts";
import { assert } from "https://deno.land/std@0.134.0/testing/asserts.ts";
import { Color } from "../../lib/Color.ts";
import { delay } from "https://deno.land/std@0.139.0/async/delay.ts";
export type WizardActions = {
    PageID: () => number,
    PageSize: () => number,
    PageData: () => FormData[],
    PageValid: () => validator.SafeParseError<unknown> | true,
    Cancel: () => void,
    Next: () => Promise<void>,
    Back: () => void,
    Submit: () => Promise<void>,
}

export type WizardSettings = {
    cancelAction: (() => void) | string,
    hideCancelButton?: () => boolean,
    buttonArrangement?: "space-between" | "flex-start" | "flex-end" | ((actions: WizardActions) => Component)
    submitAction: (pages: { data: FormData }[]) => Promise<void> | void
    nextAction?: (pages: { data: FormData }[], pageId: number) => Promise<void> | void
}
export function ValidatedDataObject<Data extends validator.AnyZodObject>(validation: (factory: typeof validator) => Data) {
    return (data: unknown) => validation(validator).safeParse(data);
}

export type Validator = (data: unknown) => validator.SafeParseReturnType<unknown, unknown>;

type NewType = (formData: FormData) => Component[];

export class PageComponent {
    private formData = new FormData();
    private proxyFormData;
    private validators = new Set<Validator>()
    private renderComponents: NewType;
    requestValidatorRun = () => { };
    #autoSpacer = true
    constructor(renderComponents: NewType) {
        this.renderComponents = renderComponents;
        this.proxyFormData = new Proxy(this.formData, {
            get: (target: any, property: any) => {
                if (!(property in target)) return undefined;
                if (property == "set") {
                    try {
                        this.requestValidatorRun()
                    } catch (_) {
                        // Yes
                    }
                }
                const value = target[ property ];
                return typeof value == "function"
                    ? (...args: any) => value.apply(target, args)
                    : value;
            }
        });
    }

    getComponents() {
        return [ ...this.renderComponents(this.proxyFormData), ...(this.#autoSpacer ? [ Spacer() ] : []) ];
    }
    addValidator<Data extends validator.AnyZodObject>(validation: (factory: typeof validator) => Data) {
        this.validators.add((data) => validation(validator).safeParse(data));
        return this;
    }
    disableAutoSpacerAtBottom() {
        this.#autoSpacer = false;
        return this;
    }
    getValidators() {
        return Array.from(this.validators.values());
    }

    getFormData() {
        return this.formData;
    }
}
/**
 * Pages are Strict Layout Views, mostly only used by a Wizard
 *
 * Upsides:
 *  - Inputs have a simple way to sync there data in a Page
 *  - Simpler work for a Wizard as it only cares about the data
 *  - Supports Validators. Validators can suport the FormData
 *
 * Downside:
 *  - Pages are not design to have dynamic layouts. (Use a Wizard)
 *  - Components can't listen on changes. They only reflect on errors.
 */
export const Page = (comp: (formData: FormData) => Component[]) => new PageComponent(comp);

export class WizardComponent extends Component {
    private pages: PageComponent[] = [];
    private settings: WizardSettings | null = null;
    private pageId = 0;
    private view = View(() => {
        const { Back, Cancel, Next, Submit, PageValid } = this.getActions();
        const footer = View(({ update }) => {
            assert(this.settings);
            const firstPage = this.pageId === 0;
            const btnAr = this.settings.buttonArrangement;
            const lastPage = this.pageId === this.pages.length - 1;
            const pageValid = PageValid() === true;
            const cancel = firstPage && !(this.settings.hideCancelButton?.())
                ? Button("Cancel")
                    .setJustify("center")
                    .setStyle(ButtonStyle.Secondary)
                    .onClick(Cancel)
                : null;
            const back = !firstPage
                ? Button("Back")
                    .setJustify("center")
                    .setStyle(ButtonStyle.Secondary)
                    .onClick(Back)
                : null;
            const next = !lastPage && this.pages.length != 1 ?
                Button("Next")
                    .setJustify("center")
                    .setColor(pageValid ? Color.Grayscaled : Color.Disabled)
                    .onClick(Next)
                : null
            const submit = lastPage ?
                Button("Submit")
                    .setJustify("center")
                    .setColor(pageValid ? Color.Grayscaled : Color.Disabled)
                    .onPromiseClick(Submit)
                : null


            let footer: Component | null = null;
            if (btnAr === "flex-start")
                footer = Horizontal(cancel, back, next, submit, Spacer())
            else if (btnAr === "flex-end")
                footer = Horizontal(Spacer(), cancel, back, next, submit)
            else if (btnAr === "space-between")
                footer = Horizontal(cancel, back, Spacer(), next, submit)
            else if (typeof btnAr === "function")
                footer = btnAr(this.getActions())
            this.pages[ this.pageId ].requestValidatorRun = () => setTimeout(() => update({}), 10);
            return footer?.addClass("footer");
        }).asComponent();
        return Vertical(
            ...this.pages[ this.pageId ].getComponents(),
            footer
        ).addClass("wwizard")
    });
    constructor(settings: WizardSettings, pages: (actions: WizardActions) => PageComponent[]) {
        super();
        this.wrapper.classList;
        this.settings = settings;
        this.pages = pages(this.getActions());
        this.view.appendOn(this.wrapper)
    }

    getActions() {
        assert(this.settings)
        const actions = <WizardActions>{
            Cancel: () => {
                if (typeof this.settings?.cancelAction == "string")
                    location.href = this.settings?.cancelAction;
                else this.settings?.cancelAction();
            },
            Back: () => {
                this.pageId--;
                this.view.viewOptions().update({});
            },
            Next: async () => {
                assert(actions.PageValid());
                this.settings?.nextAction?.(this.pages.map(x => ({ data: x.getFormData() })), this.pageId);
                this.pageId++;
                await delay(10);
                this.view.viewOptions().update({});

            },
            Submit: async () => {
                assert(actions.PageValid());
                this.settings?.nextAction?.(this.pages.map(x => ({ data: x.getFormData() })), this.pageId);
                await this.settings?.submitAction(this.pages.map(x => ({ data: x.getFormData() })))
            },
            PageValid: () => {
                const current = this.pages[ this.pageId ];
                const pageData = current.getFormData();
                return current.getValidators()
                    // note: this removed arrays, duplicates should be merged into a array
                    .map(validator => validator(Object.fromEntries(pageData.entries())))
                    .find(validator => !validator.success) ?? true;
            },
            PageID: () => this.pageId,
            PageSize: () => this.pages.length,
            PageData: () => {
                return this.pages.map(x => x.getFormData())
            }
        }
        return actions;
    }
}

export const Wizard = (settings: WizardSettings, pages: (actions: WizardActions) => PageComponent[]) => new WizardComponent(settings, pages);