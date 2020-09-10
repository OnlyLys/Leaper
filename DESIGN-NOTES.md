# Design Notes

### Removal of Event Loop

At one point (during the unreleased 0.7.0), the core of the extension involved 
an event loop that would collect content changes, selection changes and leap 
commands and only process them at the end of the each event loop.

The reason the event loop was required can be inferred from this section of 
doc-comment removed from the `Engine` class:

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
    
    Text edits are seen as an atomic operation by the user, where the actual 
    text being inserted into the buffer and the accompanying cursor movement to 
    the end of the inserted text is one operation.
    
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
    the cursor is temporarily outside the pair, even though after the actual 
    text is inserted, the cursor is within the pair.
    
    Our solution to the problem of cursors moving first is to use an event queue 
    and only process this queue at the end of every NodeJS event loop cycle 
    (which involves using an `Immediate` timer). This way, we can reorder 
    selection change events to go after content change events to make sure that 
    no pairs are erroneously removed.

The event loop was used to get around vscode's quirks. 

However, at least as of vscode 1.48, it was discovered that features like 
find-and-replace, snippet insertion and text autocompletion have been changed to 
be consistent with normal keyboard text insertions, where the content change 
comes before the cursor movement. This makes all text edits consistent, removing 
the need for a queue.
