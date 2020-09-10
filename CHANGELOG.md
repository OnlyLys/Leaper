# CHANGELOG

### 0.7.0
- Add multicursor support.
- Rewrite almost all the code to make it faster.
- Tweak default decoration to make the decorated bracket bold.
- Deprecate old configurations and replace with new counterparts:
  * `leaper.additionalTriggerPairs` is superseded by `leaper.detectedPairs`. 
    Instead of the default pairs being hardcoded into the source file, they are 
    now specified in the default value for the configuration. This allows the 
    user to see the default value of the configuration via autocomplete. 
    Furthermore, the user can now override the default value, compared to before 
    where the user can only define 'additional' pairs on top of the hardcoded 
    defaults.
  * `leaper.customDecorationOptions` is superseded by `leaper.decorationOptions`. 
    In this change, the default value was moved from source code to the package 
    manifest. Thus just like for `leaper.detectedPairs`, the user can now see 
    the default value of this configuration via autocomplete.
  * `leaper.decorateOnlyNearestPair` is superseded by `leaper.decorateAll`. This 
    is simply a rename of the configuration with an inverted truth value. The 
    rename was done to make clearer what the configuration does.
- Overhaul README to reflect the above changes.
- Significantly expand the testing suite to ensure correct behavior.
- Use 'webpack' to condense the code into one file to speed up load times.

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
- Added more tests to verify behavior.

### 0.5.0
- Remove `leaper.languageRules` contribution in favour of a global 
  `leaper.additionalTriggerPairs` rule that is simpler to understand. Now pairs 
  are detected globally instead of on a per language basis.
- Code improvements.
- Added a bunch of tests to verify behavior.

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
