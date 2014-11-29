'use strict';

$('body').ready(function () {
    poe.Elements = {
        Word: '<span class="word"></span>',
        Line: '<div class="line"></div>',
        Page: '<div class="page-inner"></div>',
        Tab: '<span class="tab word">&#8203;</span>',
        Paragraph: '<div class="paragraph"></div>',
    };
    
    poe.Selectors = {
        Word: '.word',
        Line: '.line',
        Page: '.page-inner',
        Tab: '.tab',
        Paragraph: '.paragraph'
    };

    poe.Types.Writer = 'Writer';
    poe.Types.jQuery = 'jQuery';

    poe.writer = (function () {
        var doc = new poe.Document(),
            cursor = poe.TextCursor.create(),
            toolbar = poe.toolbar,
            formatting = {
                bold: false,
                italic: false,
                underline: false,
                fontFamily: 'Open Sans',
                fontSize: 12,
                lineSpacing: 2.0,
            },
            
            lineRemoved = function (page) {
                if (page.next(poe.Selectors.Page).isValid()) {
                    page.append(page.next(poe.Selectors.Page).children(poe.Selectors.Line).first());
                }
            },
            
            checkAlignmentSpacers = function () {
                var $line;
                var padding;
                cursor.currentParagraph().children(poe.Selectors.Line).filter('.align-left').each(function (index, ln) {
                    $(ln).css('padding', '0px'); 
                });
                
                cursor.currentParagraph().children(poe.Selectors.Line).filter('.align-justify').each(function (index, ln) {
                    $(ln).css('padding', '0px'); 
                });
                
                cursor.currentParagraph().children(poe.Selectors.Line).filter('.align-right').each(function (index, ln) {
                    $line = $(ln);
                    padding = 0;
                    
                    $line.children(poe.Selectors.Word).each(function (index, w) {
                        padding += $(w).width(); 
                    });
                    
                    padding = $line.parents(poe.Selectors.Page).width() - padding - 6;
                    $line.css('padding-left', padding + 'px');
                });
                
                cursor.currentParagraph().children(poe.Selectors.Line).filter('.align-center').each(function (index, ln) {
                    $line = $(ln);
                    padding = 0;
                    
                    $line.children(poe.Selectors.Word).each(function (index, w) {
                        padding += $(w).width(); 
                    });
                    
                    padding = $line.parents(poe.Selectors.Page).width() - padding - 6;
                    padding /= 2;
                    $line.css('padding-left', padding + 'px');
                    $line.css('padding-right', padding + 'px');
                });
            },

            updateWordWrap = function () {
                $(poe.Selectors.Word).filter(':empty').remove();
                checkAlignmentSpacers();
                
                var line = cursor.currentLine(),
                    nextLine = line.next(poe.Selectors.Line),
                    lineChildren,
                    nextLineChildren,
                    linePadding,
                    doWrap = function () {
                        if (!nextLine.isValid() || line.next(poe.Selectors.Line).hasClass('newline')) {
                                line.after(poe.Elements.Line);
                                nextLine = line.next(poe.Selectors.Line);
                                nextLine.attr('class', line.attr('class'));
                            }

                        nextLine.prepend(line.children(poe.Selectors.Word).last()); 
                    };
    
                while (line.isValid() && line.children(poe.Selectors.Word).isValid()) {
                    linePadding = parseInt(line.css('padding-left').replace('px', ''));
                    while (line.children(poe.Selectors.Word).last().pos().right > line.pos().right + linePadding) {
                        doWrap();
                        checkAlignmentSpacers();
                    }
                    
                    while (nextLine.children(poe.Selectors.Word).isValid() && nextLine.children(poe.Selectors.Word).first().width() + line.children(poe.Selectors.Word).last().pos().right < $(poe.Selectors.Page).pos().right) {
                        line.append(nextLine.children(poe.Selectors.Word).first());
                        if (nextLine.is(':empty'))
                            nextLine.remove();
                    }
                    
                    line = nextLine;
                    nextLine = line.next(poe.Selectors.Line);
                }
                
                cursor.updateVisibleCursor();
            },

            updatePageBreaks = function () {
                if (cursor.currentLine().pos().bottom > cursor.currentPage().pos().bottom + parseInt(cursor.currentPage().css('padding-top').replace('px',''))) {
                    var page = $(poe.Elements.Page);
                    cursor.currentPage().after(page);
                    page.prepend(cursor.currentLine());
                    doc.pageAdded();
                }
                
                var line = cursor.currentPage().children(poe.Selectors.Paragraph).children(poe.Selectors.Line).last();
                while (line.pos().bottom > line.parents(poe.Selectors.Page).pos().bottom + doc.margins().top) {
                    line.parents(poe.Selectors.Page).next(poe.Selectors.Page).prepend(line);
                    
                    line = line.parents(poe.Selectors.Page).next(poe.Selectors.Page).children(poe.Selectors.Line).last();
                    if (!line.isValid()) {
                        break;
                    }
                }
                
                cursor.updateVisibleCursor();
                $(poe.Selectors.Page).filter(':empty').remove();
            },

            handleKeyDown = function (event) {
                if (event.ctrlKey)
                    return;
                
                switch (event.keyCode) {
                case poe.key.Left:
                    event.preventDefault();
                    var line;
                    if (cursor.prev().parent()[0] === cursor.currentPage()[0]) {
                        return;
                    }
                    
                    line = cursor.currentLine();
                    cursor.moveLeft(poe.TextCursor.Move.Char, 1);
                    //Correction to make the cursor just go over a newline
                    if (line[0] !== cursor.currentLine()[0]) {
                        cursor.moveRight(poe.TextCursor.Move.Char, 1);
                    }
                    break;

                case poe.key.Right:
                    event.preventDefault();
                    if (cursor.next().parent()[0] === $('.writer')[0])
                        return;
                    cursor.moveRight(poe.TextCursor.Move.Char, 1);
                    break;

                case poe.key.Backspace:
                    event.preventDefault();
                    if (cursor.hasSelection()) {
                        cursor.removeSelectedText();
                        $(poe.Selectors.Word).filter(':empty').remove();
                        updateWordWrap();
                        updatePageBreaks();
                        break;
                    }
                    var line;
                    
                    //Special case for tabs because well it needs it.
                    if (cursor.prevNode().hasClass('tab')) {
                        cursor.prevNode().remove();
                        updateWordWrap();
                        updatePageBreaks();
                        cursor.updateVisibleCursor();
                        return;
                    }
                        
                    if (cursor.prev().parent()[0] === cursor.currentPage()[0]) {
                        return;
                    }
                    line = cursor.currentLine();
                    cursor.moveLeft(poe.TextCursor.Move.Char, 1);
                    if (line[0] !== cursor.currentLine()[0]) {
                        cursor.moveRight(poe.TextCursor.Move.Char, 1);
                        if (line.textContent() === '') {
                            line.remove()
                            lineRemoved(cursor.currentPage());
                        }
                    } else {
                        cursor.next().remove();
                    }
                    updateWordWrap();
                    updatePageBreaks();
                    break;

                case poe.key.Delete:
                    event.preventDefault();
                    if (cursor.hasSelection()) {
                        cursor.removeSelectedText();
                        updateWordWrap();
                        updatePageBreaks();
                        break;
                    }
                        
                    if (cursor.next().parents(poe.Selectors.Line)[0] !== cursor.currentLine()[0]) {
                        cursor.nextLine().removeClass('newline');
                    }
                        
                    cursor.next().remove();
                    updateWordWrap();
                    updatePageBreaks();
                    break;

                case poe.key.Space:
                    if (cursor.hasSelection()) {
                        cursor.removeSelectedText();
                    }
                        
                    event.preventDefault();
                    cursor.insertBefore('&nbsp;');
                    var style = cursor.style();
                    cursor.currentWord().after(poe.Elements.Word);
                    cursor.moveRight(poe.TextCursor.Move.Word, 1);
                    cursor.applyCharStyle(style);
                    updateWordWrap();
                    updatePageBreaks();
                    break;

                case poe.key.Enter:
                    var style = cursor.style(),
                        paragraph = $(poe.Elements.Paragraph);
                    if (cursor.hasSelection()) {
                        cursor.removeSelectedText();
                    }
                        
                    event.preventDefault();
                    cursor.currentParagraph().after(paragraph);
                    paragraph.append(poe.Elements.Line);
                    //cursor.currentLine().after(poe.Elements.Line);
                    var word = $(poe.Elements.Word);
                    paragraph.children(poe.Selectors.Line).first().prepend(word);
                    //cursor.nextLine().prepend(word);
                    while (cursor.next().parent() === cursor.currentWord()) {
                        word.append(cursor.next());
                    }
                    
                    word.after(cursor.currentWord().nextAll());
                    cursor.moveRight(poe.TextCursor.Move.Paragraph, 1);
                    cursor.applyStyle(style);
                    updatePageBreaks();
                    break;
                        
                case poe.key.Tab:
                    event.preventDefault();
                    if (cursor.hasSelection()) {
                        cursor.removeSelectedText();
                    }
                    
                    var tab = $(poe.Elements.Tab),
                        word = $(poe.Elements.Word),
                        style = cursor.style();
                    cursor.splitWordAtCursor(function (newWord) {
                        newWord.before(tab);
                        cursor.moveRight(poe.TextCursor.Move.Word, 2);
                        cursor.moveRight(poe.TextCursor.Move.Word, 2);
                        cursor.applyStyle(style);
                    });
                    break;

                default:
                    event.preventDefault();
                    if (event.keyCode === 16) {
                        return;
                    }
                        
                    if (cursor.hasSelection()) {
                        cursor.removeSelectedText();
                    }
                        
                    var letter;
                    if (event.shiftKey) {
                        letter = poe.keyMapShift[event.keyCode];
                    } else {
                        letter = poe.keyMap[event.keyCode];
                    }

                    cursor.insertBefore(letter);
                    updateWordWrap();
                    updatePageBreaks();
                    break;
                }
            },
            
                    //The public interface of poe.writer
            self = {
                getDocument: function () {
                    return document;
                },

                getTextCursor: function () {
                    return cursor;
                },
                
                bold: function(enable) {
                    if (enable === undefined)
                        return formatting.bold;
                },
                
                italic: function(enable) {
                    if (enable === undefined)
                        return formatting.italic;
                },
                
                underline: function(enable) {
                    if (enable === undefined)
                        return formatting.underline;
                },
                
                fontFamily: function(fontName) {
                    if (fontName === undefined)
                        return formatting.fontFamily;
                    
                    formatting.fontFamily = fontName;
                },
                
                fontSize: function(size) {
                    if (size === undefined)
                        return formatting.fontSize;
                    
                    formatting.fontSize = size;
                }
            },
            
            handleResize = function () {
                updateWordWrap();
                updatePageBreaks();
                cursor.updateVisibleCursor();
                
                //Resize body
                $('.writer').css('height', ($('body').height() - $('.writer').position().top) + 'px');
            };

        //Constructor
        (function () {
            $('body').keydown(handleKeyDown);
            $(window).resize(handleResize);
            toolbar.setCursor(cursor);
            handleResize();
            cursor.on('styleChanged', function() {
                checkAlignmentSpacers();
                toolbar.styleChanged(cursor);
            });
            cursor.applyStyle(cursor.style());
            toolbar.styleChanged(cursor);
        }());
        return self;
    }());
});