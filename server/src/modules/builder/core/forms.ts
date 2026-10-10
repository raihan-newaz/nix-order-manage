import type { BuilderNode, PageDocument } from './schema';

export const fieldTypes = ['text', 'email', 'tel', 'url', 'number', 'textarea', 'select', 'radio', 'checkbox', 'date', 'time', 'range', 'hidden'];
export const fieldOptions = (node: BuilderNode) => String(node.props.options || '').split('\n').map(value => value.trim()).filter(Boolean);
export interface DocumentForm { node: BuilderNode; fields: BuilderNode[] }
export function documentForms(document: PageDocument): DocumentForm[] {
  const forms: DocumentForm[] = [];
  const visit = (nodes: BuilderNode[], form?: DocumentForm, inComponent = false, hidden = false) => {
    for (const node of nodes) {
      const invisible = hidden || node.hidden;
      if (node.type === 'form') {
        if (!String(node.props.formName || '').trim() || String(node.props.formName).length > 160) throw new Error('Form names must contain 1–160 characters');
        if (String(node.props.successMessage || '').length > 2000) throw new Error('Form success messages support up to 2,000 characters');
        if (form) throw new Error('Forms cannot be nested');
        if (inComponent) throw new Error('Forms must be placed directly on a page, outside component masters');
        const childForm = { node, fields: [] as BuilderNode[] }; if (!invisible) forms.push(childForm);
        visit(node.children, childForm, inComponent, invisible); continue;
      }
      if (node.type === 'form-field' || node.type === 'form-submit') {
        if (!form || inComponent) throw new Error('Place form controls inside a form');
        if (node.type === 'form-field') {
          if (!/^[a-z][a-z0-9_]{0,39}$/.test(String(node.props.fieldName))) throw new Error('Field keys must start with a letter and contain lowercase letters, numbers or underscores');
          if (!String(node.props.label || '').trim() || String(node.props.label).length > 160) throw new Error('Every form field needs a label of up to 160 characters');
          if (!fieldTypes.includes(String(node.props.inputType))) throw new Error('Unsupported form field type');
          if (['select', 'radio'].includes(String(node.props.inputType)) && (!fieldOptions(node).length || fieldOptions(node).length > 100)) throw new Error('Select and radio fields require 1–100 options');
          for (const key of ['min', 'max']) if (node.props[key] !== '' && node.props[key] !== undefined && !Number.isFinite(Number(node.props[key]))) throw new Error('Field minimum and maximum must be numbers');
          if (node.props.min !== '' && node.props.max !== '' && Number(node.props.min) > Number(node.props.max)) throw new Error('Field minimum cannot exceed maximum');
          if (!invisible) form.fields.push(node);
        }
      }
      visit(node.children, form, inComponent, invisible);
    }
  };
  visit(document.rootNodes);
  for (const component of Object.values(document.components)) visit(component.nodes, undefined, true);
  for (const form of forms) {
    if (form.fields.length > 50) throw new Error('A form supports up to 50 fields');
    const names = form.fields.map(field => String(field.props.fieldName));
    if (new Set(names).size !== names.length) throw new Error('Form field keys must be unique within the form');
  }
  return forms;
}

export class FormInputError extends Error {
  constructor(public readonly fields: string[]) { super('Please check your form entries'); }
}
export function validateSubmission(form: DocumentForm, input: Record<string, unknown>): Record<string, string> {
  const allowed = new Set(['_token', '_website', ...form.fields.map(field => String(field.props.fieldName))]);
  if (Object.keys(input).some(key => !allowed.has(key))) throw new FormInputError(['The form contains an unexpected field. Reload the page and try again.']);
  const result: Record<string, string> = {}; const errors: string[] = [];
  for (const field of form.fields) {
    const key = String(field.props.fieldName); const raw = input[key]; const type = String(field.props.inputType); const label = String(field.props.label);
    if (raw !== undefined && typeof raw !== 'string') { errors.push(`${label}: enter one value`); continue; }
    const value = String(raw || '').trim();
    if (value.length > 2000) { errors.push(`${label}: maximum 2,000 characters`); continue; }
    if (!value && field.props.required) { errors.push(`${label}: this field is required`); continue; }
    if (value) {
      if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(`${label}: enter a valid email address`);
      if (type === 'tel' && !/^[+\d(). -]{5,30}$/.test(value)) errors.push(`${label}: enter a valid phone number`);
      if (type === 'url') { try { if (!['http:', 'https:'].includes(new URL(value).protocol)) throw new Error(); } catch { errors.push(`${label}: enter an HTTP(S) URL`); } }
      if (['select', 'radio'].includes(type) && !fieldOptions(field).includes(value)) errors.push(`${label}: choose a listed option`);
      if (type === 'checkbox' && value !== 'on') errors.push(`${label}: invalid checkbox value`);
      if (type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) errors.push(`${label}: enter a valid date`);
      if (type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) errors.push(`${label}: enter a valid time`);
      if (type === 'number' || type === 'range') {
        const number = Number(value);
        if (!Number.isFinite(number) || (field.props.min !== '' && field.props.min !== undefined && number < Number(field.props.min)) || (field.props.max !== '' && field.props.max !== undefined && number > Number(field.props.max))) errors.push(`${label}: enter a number within the allowed range`);
      }
    }
    result[key] = value;
  }
  if (errors.length) throw new FormInputError(errors);
  return result;
}
export const csvCell = (value: unknown) => {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
