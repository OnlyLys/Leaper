# Leaper

Leaper provides the ability to leap out of autoclosing pairs with `Tab`!

## Leaper In Action

![Leaper In Action](images/leaper-in-action.gif)

![Leaper In Action 2](images/leaper-in-action-2.gif)

## How It Works

The user's input is monitored for the insertion of any autoclosing pairs. By default, these pairs (called the trigger pairs) are monitored globally:

    (), {}, [], <>, '', "", ``

When the insertion of any of these pairs are detected, the extension will begin to track its position in the document and provide the user the ability to leap out of it.

Note that the editor's `editor.autoClosingBrackets` setting must be enabled for the extension to work.

## Extension Keybindings

### `Tab` - Leap

Move the cursor to just past the closing character of the nearest available pair, **provided there is line of sight to the closing character of the pair**. If there is non-whitespace text between the cursor and the closing character then there is no line of sight.

If there are multiple nested pairs, a single leap command will only jump out of the nearest one.

This keybinding is lower in priority than accepting suggestions and overwriting active text selection, but is higher priority than jumping to next tabstop.

### `Shift` + `Escape` - Escape Leaper Mode

Clear the list of pairs that are being tracked by the extension.

This keybinding is higher in priority than closing hover tooltips (like suggestion and parameter hints), cancelling text selection and leaving snippet mode.

## Extension Contributions

### `leaper.customDecorationOptions`

The decoration of the closing character can also be customized.

For instance, to have a black outline appear around the closing character of a pair, the contribution can be set to:

    "leaper.customDecorationOptions": {
        "outlineColor": "black",
        "outlineWidth": "1px",
        "outlineStyle": "solid"
    }

For the entire list of available properties, please see [vscode namespace API - DecorationRenderOption](https://code.visualstudio.com/docs/extensionAPI/vscode-api#DecorationRenderOptions). Note that not all options available there can be used since there is no way to instantiate a `ThemeColor` type within the editor's settings file.

To turn off the decoration, just set it to an empty brace:

    "leaper.customDecorationOptions": {}

### `leaper.decorateOnlyNearestPair`

The default behavior of Leaper is to decorate only the nearest pair that is being tracked. 

To decorate all the pairs that are being tracked, set this contribution to `false`. The decorations will then look like:

![Decorate All Pairs](images/decorate-all-pairs.gif)

### `leaper.additionalTriggerPairs`

Users can use this contribution to add additional pairs that will trigger the extension. Pairs are specified with the format: 

    { "open": "_open_character_", "close": "_close_character_" }

For instance, say we want to add detection for a pair that is `||`. All we need to do is to set the contribution to:

    "leaper.additionalTriggerPairs": [
        { "open": "|", "close": "|" }
    ],

## Feedback and Help

Your feedback and help are very much encouraged! Please visit the [GitHub repository](https://github.com/OnlyLys/Leaper) to contribute.