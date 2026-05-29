declare module "frappe-gantt" {
    export default class Gantt {
        constructor(element: HTMLElement | string, tasks: Array<Record<string, unknown>>, options?: Record<string, unknown>);
        clear(): void;
    }
}
