import { CommonModule } from '@angular/common';
import { Component, Input, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import tippy from 'tippy.js';
import type { Instance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';

@Component({
  selector: 'app-question-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="inline-block">
      <span
        #helpEl
        [attr.class]="_helpClasses"
        tabindex="0"
        [attr.aria-label]="text"
      >
        ?
      </span>
      <div #tooltipContent style="display:none" [innerHTML]="text"></div>
    </span>
  `,
  styles: [
    `
    :host {
      display: inline-block;
    }
    /* Allow callers to apply spacing classes on the host (e.g. class="ml-2") */
    :host(.ml-2) {
      margin-left: 0.5rem;
    }
    :host ::ng-deep .help-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 9999px;
      background: #f8fafc;
      color: #334155;
      font-weight: 600;
      border: 1px solid #e2e8f0;
      cursor: help;
      font-size: .7rem;
      margin: 0;
      position: relative;
      z-index: 60;
      pointer-events: auto;
      line-height: 1;
    }
    :host ::ng-deep .help-icon--gradient {
      background: linear-gradient(90deg,#6b46c1,#b83280);
      color: #fff;
      border-color: transparent;
    }
    /* Ensure tooltip content preserves normal flow: lists, headings and paragraphs */
    :host ::ng-deep .tippy-box[data-theme~="help"] .tippy-content {
      white-space: normal;
      color: #fff;
      font-size: 0.95rem;
    }
    :host ::ng-deep .tippy-box[data-theme~="help"] .tippy-content p {
      margin: 0 0 0.5rem 0;
      line-height: 1.35;
    }
    :host ::ng-deep .tippy-box[data-theme~="help"] .tippy-content h4 {
      margin: 0 0 0.35rem 0;
      font-size: 0.95rem;
      font-weight: 600;
    }
    :host ::ng-deep .tippy-box[data-theme~="help"] .tippy-content ul {
      margin: 0 0 0.5rem 1.25rem;
      padding-left: 1.25rem;
      list-style-type: disc !important;
      list-style-position: outside !important;
      list-style: disc outside !important;
      padding-left: 1.25rem !important;
      margin-left: 0 !important;
    }
    :host ::ng-deep .tippy-box[data-theme~="help"] .tippy-content li {
      margin-bottom: 0.25rem;
    }
    :host ::ng-deep .tippy-box[data-theme~="help"] .tippy-content li::marker {
      color: inherit;
      font-size: 1em;
    }
    /* Force bullets to be visible even if global CSS removed them */
    :host ::ng-deep .tippy-box[data-theme~="help"] .tippy-content ul,
    :host ::ng-deep .tippy-box[data-theme~="help"] .tippy-content li {
      -webkit-margin-before: 0px !important;
      -webkit-margin-after: 0px !important;
      -webkit-padding-start: 1.25rem !important;
    }
    `
  ]
})
export class QuestionTooltipComponent implements AfterViewInit, OnDestroy {
  // using tippy for tooltip content; help icon always visible
  @Input() text = '';
  @Input() variant: 'inline' | 'badge' = 'badge';
  @Input() placement: any = 'bottom';
  @Input() maxWidth = 320;
  @Input() theme = 'help';
  @Input() animation: any = 'shift-away';

  get _helpClasses(): string {
    // default: small gray circular badge (matches the original appearance)
    if (this.variant === 'badge') {
      return this.theme === 'help' ? 'help-icon help-icon--gradient' : 'help-icon';
    }
    // inline compact variant (not used by default)
    return 'inline-block text-white text-sm font-medium cursor-default';
  }

  @ViewChild('helpEl', { read: ElementRef }) helpEl?: ElementRef<HTMLElement>;
  @ViewChild('tooltipContent', { read: ElementRef }) tooltipContent?: ElementRef<HTMLElement>;
  private _tippy?: Instance | null;

  ngAfterViewInit(): void {
    try {
      const el = this.helpEl?.nativeElement;
      if (!el) return;
      const desiredMaxWidth = this._computeMaxWidth(this.text);
      // Prefer passing a cloned DOM node so tippy renders exact markup (lists, markers)
      const clonedNode = this.tooltipContent?.nativeElement?.cloneNode(true) as HTMLElement | undefined;
      if (clonedNode && clonedNode.style) {
        // cloned node inherits `display:none` from the hidden template; make it visible
        clonedNode.style.display = '';
        try {
          // Ensure bullet markers and spacing are visible by applying inline styles
          const uls = (clonedNode as HTMLElement).querySelectorAll('ul');
          uls.forEach((u) => {
            const el = u as HTMLElement;
            el.style.listStyleType = 'disc';
            el.style.listStylePosition = 'outside';
            el.style.listStyle = 'disc outside';
            el.style.paddingLeft = '1.25rem';
            el.style.margin = '0 0 0.5rem 0';
          });
          const lis = (clonedNode as HTMLElement).querySelectorAll('li');
          lis.forEach((li) => {
            const lel = li as HTMLElement;
            lel.style.marginBottom = '0.25rem';
          });
        } catch (e) {
          // ignore styling errors
        }
      }
      const contentValue = clonedNode ?? (this.tooltipContent?.nativeElement?.innerHTML ?? this.text);
      this._tippy = tippy(el, {
        interactive: true,
        // content is a DOM node or HTML string
        content: contentValue,
        allowHTML: true,
        placement: this.placement,
        maxWidth: desiredMaxWidth,
        appendTo: document.body,
        theme: this.theme,
        animation: this.animation,
        onShow(instance) {
          const box = instance.popper.querySelector('.tippy-box');
          if (box) {
            box.classList.remove('animate__animated', 'animate__rubberBand');
            const _ = (box as HTMLElement).offsetWidth;
            box.classList.add('animate__animated', 'animate__rubberBand');
          }
        },
        onHidden(instance) {
          const box = instance.popper.querySelector('.tippy-box');
          if (box) box.classList.remove('animate__animated', 'animate__rubberBand');
        }
      });

      const enter = () => this._tippy?.show();
      const leave = () => this._tippy?.hide();
      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      el.addEventListener('focus', enter);
      el.addEventListener('blur', leave);

      // store removal function
      this._removeListeners = () => {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseleave', leave);
        el.removeEventListener('focus', enter);
        el.removeEventListener('blur', leave);
      };
    } catch (err) {
      // ignore tippy init errors
      // eslint-disable-next-line no-console
      console.warn('question-tooltip: tippy init failed', err);
    }
  }

  private _removeListeners?: () => void;

  ngOnDestroy(): void {
    if (this._tippy) {
      try {
        this._tippy.destroy();
      } catch {
        // ignore
      }
      this._tippy = null;
    }
    if (this._removeListeners) this._removeListeners();
  }

  // Note: content is provided by the static hidden DOM node `#tooltipContent`.
  // Previous inline text->HTML renderer removed in favor of Angular's `[innerHTML]`.

  // Compute a sensible max width: use a larger width when the text is long
  // or contains long lines. Clamp between 320 and 800 px.
  private _computeMaxWidth(text: string): number {
    if (!text) return this.maxWidth;
    const normalized = text.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    const longestLine = lines.reduce((a, b) => a.length > b.length ? a : b, '');
    // approximate char width in px (conservative): 8px per char
    const approxPx = Math.min(800, Math.max(this.maxWidth, Math.ceil(longestLine.length * 8)));
    // if overall text is very long, slightly increase width to avoid excessive wrapping
    if (text.length > 800) return Math.min(800, approxPx + 120);
    if (text.length > 400) return Math.min(700, approxPx + 80);
    return Math.max(this.maxWidth, approxPx);
  }
}
