# CHANGELOG

### 0.5.3
- Fix issue where extension is not relinquishing control of `Tab` key after jumping out of the last pair.

### 0.5.2
- Make decorations more efficient by only updating when necessary.
- Show warning message when incorrect trigger pairs specified in `leaper.additionalTriggerPairs`. 
- Minor README fixes.

### 0.5.1
- Code improvements.
- Added more tests to verify behavior.

### 0.5.0
- Remove `leaper.languageRules` contribution in favour of a global `leaper.additionalTriggerPairs` rule that is simpler to understand. Now pairs are detected globally instead of on a per language basis.
- Code improvements.
- Added a bunch of tests to verify behavior.

### 0.4.2
- Fix issues with README file.
- Remove 'preview' from extension manifest.

### 0.4.1
- Code clean up. No functional changes.

### 0.4.0
- 'Leap' command now works differently when used via the `Tab` keybinding vs. the command palette command. 'Leap' requires line of sight (i.e. have no non-whitespace text between the cursor position and the leap target) when used via the `Tab` key, while the command palette key does not.

### 0.3.0
- Change default keybinding of 'Escape Leaper Mode' to `Shift` + `Escape` so that there is less conflict with other built-in editor keybindings for `Escape`.

### 0.2.1
- Command to 'leap' and 'escape leaper mode' added into the command pallete when the context allows for it.

### 0.2.0
- Refactored a majority of the code. 
- Extension now works properly during text insertion and deletion.

### 0.1.0 
- Initial release of the extension. 