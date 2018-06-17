'use strict';

import { ExtensionContext } from 'vscode';
import { Controller } from './controller';

export function activate(context: ExtensionContext) {
    const controller = new Controller();
    context.subscriptions.push(controller);
}

export function deactivate() {
    // Intentionally empty
}