# Leaper

Leaper provides the ability to leap out of autoclosing pairs with `Tab`!

## Leaper In Action

![Leaper In Action](images/leaper-in-action.gif)

![Leaper In Action 2](images/leaper-in-action-2.gif)

## How It Works

The user's input is monitored for the insertion of any autoclosing pairs. By default, these are monitored:

    (), {}, [], <>, '', "", ``

When any of these autoclosing pairs are inserted, the extension will begin to track its position in the document and provide the user the ability to leap (i.e. jump) out of it. Once the cursor is moved outside the pair, it will no longer be tracked. 

## Keybindings

### `Tab` - Leap

Move the cursor to just past the closing character of the nearest available pair, **provided there is line of sight to the closing character of the pair**. If there is non-whitespace text between the cursor and the closing character then there is no line of sight.

If there are multiple nested pairs, a single leap will only leap out of the nearest one.

#### _Potential Conflict With Tab Completion Feature_

`leaper.leap`'s default keybinding: 

    {
        "key": "tab",
        "command": "leaper.leap",
        "when": "leaper.inLeaperMode && leaper.hasLineOfSight && editorTextFocus && !editorHasSelection && !editorTabMovesFocus && !suggestWidgetVisible"
    },

while suitable for most use cases, can conflict with VS Code's [tab completion feature](https://code.visualstudio.com/docs/editor/intellisense#_tab-completion), since that requires the user to press the `Tab` key, possibly at places where there are pairs that can be leaped out of. Since [extension keybindings have higher priority than VS Code's default keybindings](https://code.visualstudio.com/docs/getstarted/keybindings#_keyboard-rules), this means that the `leaper.leap` will always occur even if the user's intention was to cycle to the next tab completion suggestion. 

The tab completion keybindings (`insertBestCompletion` and `insertNextSugggestion`) could be rebound to another key to avoid the conflict. Otherwise, `leaper.leap` could be rebound as well to avoid the conflict. 

Note that tab completion is not the same as quick suggestion, which is the default suggestion method in VS Code.

### `Shift` + `Escape` - Escape Leaper Mode

Clear the list of pairs that are being tracked by the extension.

## Configurations

### `leaper.customDecorationOptions`

You can use this configuration to customize the decoration for the closing character of a pair. For instance, to have a black outline appear around it, it could be set to:

    "leaper.customDecorationOptions": {
        "outlineColor": "black",
        "outlineWidth": "1px",
        "outlineStyle": "solid"
    }

For the entire list of available properties, please see VS Code's [DecorationRenderOptions](https://code.visualstudio.com/api/references/vscode-api#DecorationRenderOptions).

To turn off the decoration, just set it to an empty object:

    "leaper.customDecorationOptions": {}

### `leaper.decorateOnlyNearestPair`

The default behavior of Leaper is to decorate only the nearest pair that is being tracked. 

To decorate all the pairs that are being tracked, set this to `false`. The decorations will then look like:

![Decorate All Pairs](images/decorate-all-pairs.gif)

### `leaper.additionalTriggerPairs`

You can add use this configuration to add additional pairs to be detected. Pairs are specified with the format: 

    { "open": "*open_character*", "close": "*close_character*" }

For instance, say we want to add detection for an autoclosing pair that is `||`. All we need to do is to set this configuration to:

    "leaper.additionalTriggerPairs": [
        { "open": "|", "close": "|" }
    ],

## Feedback and Help

Please visit the [GitHub repository](https://github.com/OnlyLys/Leaper).