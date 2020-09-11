# Design Notes

## 0.7.0 -> 0.8.0
------------------------

0.7.0 was a massive rewrite of the code to handle multi-cursors. However, the
approach taken in 0.7.0 was not ideal, and therefore prompted two other rewrites 
that concluded with 0.8.0.

Some of the notable design decisions during the transition are noted here.

### Only Apply Decorations at the End of Event Loop Cycles

One of the main changes made is to only apply decorations at the end of each event 
loop cycle.

Previously decorations were applied as the pairs were detected, however that 
created a problem because vscode only actually applies decorations during the next 
cycle.

Consider a situation where there are two content changes in a cycle, where the 
first one inserts a pair and the second inserts some text in between the pair. 
Because vscode only applies decorations in the next cycle, it would end up 
decorating the text in between the pair, since the call to apply the decorations
specified the position of the pairs before the text of the second content change 
was inserted in between.

By only applying decorations at the end of each event loop cycle, we make sure 
that the decorations are applied at the position that the pairs would be in when 
the decorations are actually applied by vscode.

### Separate Keybinding Contexts to Internal and External Values

It was discovered that when setting keybinding contexts via the 'setContext' 
command, the broadcasted context values could take multiple cycles before they
are acknowledged by vscode. 

Previously, we relied on disabling the keybinding for the 'Leap' command to gate
the control flow. When we didn't want the `leap` method to be called, we would 
disable the keybinding. But because broadcasted context values are not immediately 
acknowledged, there is a small window of time where the `leap` method could still 
be called.

In order to fix the aforementioned problem, we separated the keybinding contexts 
into internal and external values. The internal values are stored in variables
while external values are 'fire-and-forget' values broadcasted to vscode. Since 
the internal values can be instantaneously updated, they are used within the code 
path to gate the `leap` method, while the external values are only used to toggle 
keybindings. 

### Only Update Keybinding Contexts on Demand

Along with the separation of keybinding contexts to internal and external values, 
keybinding contexts have been changed to only recalculate their values when needed.

Previously, after each selection change event and content change event, context
values are recalculated. 

However, frequent recalculation is unnecessary because the earliest a broadcasted 
context value could be acknowledged is during the next event loop cycle. This 
means that if we broadcasted context values multiple times within a cycle, only 
the last one will matter since overwrites the effects of any prior ones broadcasted 
in the same cycle. Therefore, it is much more efficent for us to only broadcast 
context values once at the end of event loop cycles.

### Sort Cursors Before Handling Them

The array of cursors obtained through `TextEditor.selections` does not have a
definite ordering and could be silently reordered at any time by vscode. This
was a problem because inconsistent ordering made it difficult to tell which 
cursors were added or removed.

So now we always sort cursors before handling them. 

Sorting cursors incurs a runtime cost of O(lg(n)). However, that is worth it 
because it allows for greatly optimizing the "sync to content change" step. See 
the next subsection ('Redesign the `Tracker` Class') for more info.

### Redesign the `Tracker` Class 

The `Tracker` class was previously used to manage the pairs for a single cursor,
where cursor had its own `Tracker` instance.

However, having separate management of pairs for each cursor made it difficult
to optimize the code, since it was difficult for a `Tracker` to pass information
to another `Tracker`. 

Therefore, in 0.8.0, `Tracker` was changed to handle the pairs for all cursors.

The aforementioned change combined with the change to only handle sorted cursors
enabled a rewrite of the "sync to content change" step (also known as "content
change update" step) that reduced its runtime complexity from O(n^2) to O(n), 
since it was now possible to make a single pass through both the pairs in `Tracker` 
and the array of content changes. 

### Remame `Controller` to `Engine`

The core class of this extension was renamed to `Engine`, which is a name that
better represents its purpose.

To go along with the rename, the control flow of this class was simplified. 
Instead of always getting the active text editor via `window.activeTextEditor`, 
which is possibly `undefined`, we bind each `Engine` instance to a specific text 
editor. This eliminated many `undefined` value checks and made the control flow
much clearer.

### Remove Handling of Erroneously Removed Pairs

When this extension was first created, vscode was inconsistent with whether the 
content change event or selection change event came first during text insertions.

When content changes came first, it was fine, but when selection changes came 
first, such as during snippet insertion, it would cause pairs to be erroneously
untracked.

In version 0.6.0, the fix for that problem was to have a 'recovery' array, where
any pairs removed after a selection change update can be recovered by the next
content change update. 

In version 0.7.0, the fix involved delaying selection change updates until the 
end of the event loop cycle. This gets around the problem of selection change
events coming first since we delay processing selection change events until after 
content change events have been processed.

In between version 0.7.0 and 0.8.0, an attempt was made to expand the approach
taken in version 0.7.0 by using an event queue that would collect content change
events, selection change events and leap commands, and only process them at the 
end of the each event loop cycle. The following preserved section of doc-comment 
from the `Engine` class describes the motivation we had for using an event queue:

    # Event Queue
    
    Each instance of this class is fed information through the `enqueue` method, 
    which places events into a queue. 
    
    Content change events and selection change events in particular are used to 
    infer modifications the user has made to the bound text editor. This 
    information is then used to do things such as:
    
     - Detect whether autoclosing pairs have been inserted into the document.
     - Track the status of previously inserted autoclosing pairs.
     - Determine whether the cursor has moved out of pairs of interest.
    
    Note that whenever the event queue is populated, it will automatically 
    schedule an `Immediate` timer to process the queue at the end of the current 
    event loop cycle.
    
    ## Why Use a Queue?
    
    The use of an event queue is motivated by a quirk in vscode when it comes to 
    text edits.
    
    Text edits are seen as an atomic operation by the user, where the actual text 
    being inserted into the buffer and the accompanying cursor movement to the 
    end of the inserted text is one operation.
    
    However, internally, the insertion of the text into the text buffer and the 
    cursor movement are two separate events, and their ordering is unspecified. 
    In other words, either the content change event of the text insertion or the 
    selection change event of the cursor movement could fire first.
    
    For example, when typing characters with the keyboard, or when pasting text 
    into the editor, the actual text is inserted into the text buffer before the 
    cursor is moved to the end of the inserted text. On the other hand, when 
    using autocompletion, the cursor is moved to its final position first before 
    the autocompleted text is inserted.
    
    The cursor moving first during text autocompletion is a problem, since one 
    of the behaviors of this extension is to untrack pairs that the cursor has 
    moved out of. Consider a situation where the cursor is currently within a 
    pair that is being tracked, and text is autocompleted at where the cursor is 
    at. If we do not use an event queue, but instead process events as they fire, 
    we would be untracking the pair during the initial 'transient' state where 
    the cursor is temporarily outside the pair, even though after the actual text 
    is inserted, the cursor is within the pair.
    
    Our solution to the problem of cursors moving first is to use an event queue 
    and only process this queue at the end of every NodeJS event loop cycle 
    (which involves using an `Immediate` timer). This way, we can reorder 
    selection change events to go after content change events to make sure that 
    no pairs are erroneously removed.

However, as of vscode 1.48, it was discovered that features like find-and-replace, 
snippet insertion and text autocompletion have been made consistent with normal 
keyboard text insertions, where the content change event comes first. This meant
there is no longer a need for handling erroneously removed pairs since selection
change events no longer come first during text insertions.
