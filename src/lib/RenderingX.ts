import { createElement, custom, span } from "../components/Components";
import { loadingWheel } from "../components/light-components/loadingWheel";
import { RenderComponent, RenderElement } from "../types/RenderingX";

export class RenderingX {
    private staticNotify: HTMLElement;
    private dialogShell: HTMLElement;
    constructor() {
        const notify: HTMLElement | null = document.querySelector('#notify');
        if (notify)
            this.staticNotify = notify;
        else {
            const notifyNew = createElement('div');
            notifyNew.id = "notify";
            notifyNew.classList.add('notify');
            document.body.append(notifyNew);
            this.staticNotify = notifyNew;
        }

        this.dialogShell = createElement('div');
        this.dialogShell.classList.add('dialog-shell');
        document.body.append(this.dialogShell)
    }

    notify(test: string, keepOpenUntilDone?: () => Promise<undefined>) {
        const notifcation = span(test)
        if (keepOpenUntilDone === undefined)
            setTimeout(() => notifcation.remove(), 6010);
        else keepOpenUntilDone().then(() => notifcation.remove())
        this.staticNotify.append(notifcation);
    }

    toDialog(options: { title?: string | HTMLElement, content: RenderElement | HTMLElement, buttons?: [ label: string, action: ((() => undefined | 'close' | 'remove-close') | (() => Promise<undefined | 'close' | 'remove-close'>) | 'auto-close' | 'auto-close-remove'), color?: 'normal' | 'red' ][] } | HTMLElement) {

        const dialogBackdrop = custom('div', undefined, 'dialog-backdrop')
        const closeDialog = (autoRemove = true) => {
            dialogBackdrop.classList.remove('open')
            document.body.style.overflowY = "unset";
            if (autoRemove) dialogBackdrop.remove()
        };

        if (options instanceof HTMLElement) {
            options.classList.add('dialog')
            dialogBackdrop.append(options);
        } else {
            const dialog = createElement('div')

            dialog.classList.add('dialog')
            dialogBackdrop.append(dialog);
            if (options.title) dialog.append(span(options.title, 'dialog-title'))

            const renderedContent = options.content instanceof HTMLElement ? options.content : options.content.draw();

            renderedContent.classList.add('dialog-content')
            dialog.append(renderedContent)

            if (options.buttons) {
                const buttonList = createElement('buttonlist')

                options.buttons.forEach(([ language, action, color = 'normal' ]) => {
                    const button = custom('button', language, color)
                    button.onclick = () => {
                        if (buttonList.classList.contains('loading')) return;
                        if (action === 'auto-close')
                            closeDialog(false)
                        else if (action === 'auto-close-remove')
                            closeDialog()
                        else {
                            const exec = action()
                            button.append(loadingWheel())
                            if (exec instanceof Promise) {
                                buttonList.classList.add('loading')
                                button.classList.add('loading')
                                exec.then((onSubmit) => {
                                    if (onSubmit) closeDialog(onSubmit === 'remove-close')
                                    buttonList.classList.remove('loading')
                                    button.classList.remove('loading')
                                })
                            } else if (exec)
                                closeDialog(exec === 'remove-close')

                        }
                    }
                    buttonList.append(button);
                })
                dialog.append(buttonList)
            }
        }

        this.dialogShell.append(dialogBackdrop)
        return {
            open: () => {
                dialogBackdrop.classList.add('open')
                document.body.style.overflowY = "hidden";
            },
            close: closeDialog
        };
    }

    toBody = <DataT>(options: { maxWidth?: string }, initStateData: DataT | undefined, data: (redraw: (updateStateData?: DataT) => void) => RenderComponent<DataT>[]) =>
        this.toCustom({ ...options, shell: document.body }, initStateData, data)

    toCustom<DataT>(options: { maxWidth?: string, shell: HTMLElement }, initStateData: DataT | undefined, data: (redraw: (updateStateData?: DataT) => void) => RenderComponent<DataT>[]) {
        const shell = createElement('article')
        let state = initStateData;
        options.shell.append(shell)
        if (options.maxWidth) {
            shell.classList.add('maxWidth');
            shell.style.maxWidth = options.maxWidth;
        }

        let drawedElements: [ number, HTMLElement | undefined ][] = [];

        const fetchedData = data((updateState) => {
            if (updateState !== undefined) {
                state = { ...state, ...updateState };
                fullRedraw()
            }
            else
                drawFromCache()
        })
        function singleRedrawFunction(index: number, updateState: any) {
            if (updateState !== undefined) {
                state = { ...state, ...updateState };
            }
            const data = drawedElements.find(([ findIndex ]) => findIndex == index)
            if (data) data[ 1 ] = undefined;
            drawFromCache()
        }

        function drawFromCache() {
            shell.innerHTML = "";
            shell.append(...drawedElements.map(element => {
                if (element[ 1 ] != undefined)
                    return element[ 1 ];
                const reDrawElement = fetchedData[ element[ 0 ] ];
                const preRendered = typeof reDrawElement == "object"
                    ? reDrawElement.draw()
                    : reDrawElement((updateState) => singleRedrawFunction(element[ 0 ], updateState), state as any).draw()
                drawedElements.find(x => x[ 0 ] == element[ 0 ])![ 1 ] = preRendered;
                return preRendered;
            }));
        }

        function fullRedraw() {
            drawedElements = [];
            drawedElements = fetchedData.map((x, index) => [
                index,
                typeof x == "object"
                    ? x.draw()
                    : x((updateState) => singleRedrawFunction(index, updateState), state as any).draw()
            ])
            drawFromCache()
        }
        fullRedraw()

        return {
            getState: () => initStateData,
            redraw: (data?: Partial<DataT>) => {
                if (data !== undefined) {
                    state = { ...state, ...data } as any;
                }
                fullRedraw()
            }
        }
    }
}