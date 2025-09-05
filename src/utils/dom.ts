/**
 * DOM utility functions for element manipulation
 */

export const getElementById = (id: string): HTMLElement | null => 
  document.getElementById(id);

export const querySelectorAll = <T extends Element>(selector: string): NodeListOf<T> =>
  document.querySelectorAll<T>(selector);

export const toggleClass = (element: HTMLElement, className: string, force?: boolean): void => {
  element.classList.toggle(className, force);
};

export const setElementContent = (element: HTMLElement | null, content: string): void => {
  if (element) {
    element.textContent = content;
  }
};

export const showElement = (element: HTMLElement | null): void => {
  if (element) {
    element.classList.remove('hidden');
    element.style.display = '';
  }
};

export const hideElement = (element: HTMLElement | null): void => {
  if (element) {
    element.classList.add('hidden');
    element.style.display = 'none';
  }
};

export const padNumber = (num: number): string => 
  num < 10 ? `0${num}` : num.toString();
