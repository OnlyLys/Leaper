# CHANGELOG

### 0.10.0
- Allow the extension to run in untrusted workspaces. 
- Fix incorrect extension packaging. The fix in 0.9.3 did not work.
- Hide the 'Leap' and 'Escape Leaper Mode' commands from the command palette.
- Improve the `leaper.decorationOptions` configuration.
  * Add autocompletion and validation for most of the options.
  * Add a few examples of decoration options.
  * Allow theme color identifiers to be specified with strings.
  * Change the default decoration to something with more contrast.
  * Require `null` instead of `{}` to disable decorations.
- Improve the descriptions of configurations.
- Improve the engine code.
  * Allow configurations to be hot reloaded.
  * Remove a lot of complexity from the code.
- Improve the README.

### 0.9.3 _(Not published to marketplace)_
- Fix incorrect extension packaging. This should reduce the file size.

### 0.9.2 _(Not published to marketplace)_
- Slightly simplify the code.
- Use [esbuild] to reduce the extension's loading time and file size.

[esbuild]: (https://code.visualstudio.com/api/working-with-extensions/bundling-extension#using-esbuild) 

### 0.9.1 _(Not published to marketplace)_
- Restructure some of the code to improve readability and robustness.

### 0.9.0 _(Not published to marketplace)_
- Add support for context switching (i.e. handle multiple visible text editors 
  at a time. Users can now insert pairs in one editor, switch to another editor, 
  then come back and still have the pairs be 'leapable', as the user had left 
  them.

### 0.8.0 _(Not published to marketplace)_
- Add multicursor support.
- Rewrite almost all of the code to reduce overhead.
- Tweak default decoration to make the decorated bracket bold.
- Deprecate old configurations and replace with new counterparts:
  * Replace `leaper.additionalTriggerPairs` with `leaper.detectedPairs`. 
  * Replace `leaper.customDecorationOptions` with `leaper.decorationOptions`.
  * Replace `leaper.decorateOnlyNearestPair` with `leaper.decorateAll`.
- Overhaul README to reflect the above changes.
- Make the 'Leap' command work the same whether through the `Tab` keybinding or 
  through the command pallete. This reverses the change introduced in `0.4.0`.

### 0.7.0 _(Scrapped)_
- This version was scrapped and never published.

### 0.6.0
- Remove the unnecessary `!config.emmet.triggerExpansionOnTab` when context for 
  the `leaper.leap` keybinding (https://github.com/OnlyLys/Leaper/issues/4).
- Improved the README.

### 0.5.3
- Fix issue where extension is not relinquishing control of `Tab` key after 
  jumping out of the last pair.

### 0.5.2
- Make decorations more efficient by only updating when necessary.
- Show warning message when incorrect trigger pairs specified in 
  `leaper.additionalTriggerPairs`. 
- Minor README fixes.

### 0.5.1
- Code improvements.

### 0.5.0
- Remove `leaper.languageRules` contribution in favour of a global 
  `leaper.additionalTriggerPairs` rule that is simpler to understand. Now pairs 
  are detected globally instead of on a per language basis.
- Code improvements.

### 0.4.2
- Fix issues with README file.
- Remove 'preview' from extension manifest.

### 0.4.1
- Code clean up. No functional changes.

### 0.4.0
- 'Leap' command now works differently when used via the `Tab` keybinding vs. 
  the command palette command. 'Leap' requires line of sight (i.e. have no 
  non-whitespace text between the cursor position and the leap target) when used 
  via the `Tab` key, while the command palette key does not.

### 0.3.0
- Change default keybinding of 'Escape Leaper Mode' to `Shift` + `Escape` so 
  that there is less conflict with other built-in editor keybindings for `Escape`.

### 0.2.1
- Command to 'leap' and 'escape leaper mode' added into the command pallete when 
  the context allows for it.

### 0.2.0
- Refactored a majority of the code. 
- Extension now works properly during text insertion and deletion.

### 0.1.0 
- Initial release of the extension. 
