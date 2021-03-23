import { createElement, span } from "../components";
import { richCard } from "./richCard";

export const loginCard = ({ titleText, email, url, button, password, makeLogin, errorMessage }: {
    titleText?: string
    email?: { text: string, default?: string },
    url?: { text: string, default?: string },
    button?: string,
    password?: { text: string, default?: string },
    errorMessage?: string,
    makeLogin: (loginData: { password: string, email?: string, url?: string }) => Promise<boolean>
}) => {
    let form = createElement("form") as HTMLFormElement;
    let emailField = createElement("input") as HTMLInputElement;
    let passwordFiled = createElement("input") as HTMLInputElement;
    let urlField = createElement("input") as HTMLInputElement;
    if (url) {
        urlField.type = "url";
        urlField.classList.add('default');
        urlField.placeholder = url.text;
        if (url.default)
            urlField.value = url.default;
        form.append(urlField);
    }
    if (email) {
        emailField.type = "email";
        emailField.placeholder = email.text;
        emailField.classList.add('default');
        if (email.default)
            emailField.value = email.default;
        form.append(emailField);
    }
    if (password) {
        passwordFiled.type = "password";
        passwordFiled.placeholder = password.text;
        passwordFiled.classList.add('default');
        if (password.default)
            passwordFiled.value = password.default;

        form.append(passwordFiled);
    }
    let buttonInput = createElement("input") as HTMLInputElement;
    buttonInput.type = "button";
    buttonInput.value = button || "Login";
    if (password)
        passwordFiled.onkeyup = (e) => {
            if (e.key == "Enter")
                buttonInput.click();
        }
    const loader = createElement("div");
    loader.classList.add('loader');

    loader.append(buttonInput);
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 73 73")
    icon.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    icon.setAttribute("fill", "none");
    icon.innerHTML = `<circle cx="36.5" cy="36.5" r="35.5" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    loader.append(icon);
    const content = span(errorMessage ?? 'wrong credentials', 'content');
    form.append(loader, content);
    buttonInput.onclick = () => {
        if (loader.classList.contains('loading'))
            return;
        loader.classList.add('loading')
        makeLogin({
            password: passwordFiled.value,
            email: emailField.value || undefined,
            url: urlField.value || undefined
        }).then((response) => {
            if (!response) {
                loader.classList.remove('loading');
                content.classList.add('failed');
            }
        })
    }

    return richCard({
        title: titleText || "Login",
        content: form
    });
}