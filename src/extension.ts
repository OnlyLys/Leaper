'use strict';

import { ExtensionContext } from 'vscode';
import { Controller } from './controller';

export let controller: Controller;

export function activate(context: ExtensionContext) {
    controller = Controller.start();
    context.subscriptions.push(controller);
}

export function deactivate() {
    // Intentionally empty
}