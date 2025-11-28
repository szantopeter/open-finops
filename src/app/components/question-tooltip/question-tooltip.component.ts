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
    </span>
  `,
  styles: [
    `
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
    `
  ]
})
export class QuestionTooltipComponent implements AfterViewInit, OnDestroy {
  // using tippy for tooltip content; help icon always visible
  @Input() text = '';
  @Input() variant: 'inline' | 'badge' = 'badge';
  @Input() placement: any = 'bottom';
  @Input() maxWidth = 320;
  @Input() theme = 'wk-help';
  @Input() animation: any = 'shift-away';

  get _helpClasses(): string {
    // default: small gray circular badge (matches the original appearance)
    if (this.variant === 'badge') {
      return 'help-icon';
    }
    // inline compact variant (not used by default)
    return 'inline-block text-white text-sm font-medium cursor-default';
  }

  @ViewChild('helpEl', { read: ElementRef }) helpEl?: ElementRef<HTMLElement>;
  private _tippy?: Instance | null;

  ngAfterViewInit(): void {
    try {
      const el = this.helpEl?.nativeElement;
      if (!el) return;

      this._tippy = tippy(el, {
        content: this.text,
        allowHTML: false,
        placement: this.placement,
        maxWidth: this.maxWidth,
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
}
