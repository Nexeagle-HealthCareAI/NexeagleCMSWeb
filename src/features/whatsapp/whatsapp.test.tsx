import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('./access', () => ({
  WA_MOCK: true,
  canViewWhatsApp: () => true,
  waCan: () => ({ view: true, reply: true, contacts: true, broadcast: true, templates: true, approve: true, settings: true, patients: true }),
}));

import WhatsAppPage from './WhatsAppPage';
import { checkTemplate, csvToContacts, requiredKeys, variablesIn, windowLeft } from './waUtils';
import { visibleGroups } from '../../components/nav/navConfig';
import type { WaSaveTemplate } from './types';

const open = (path = '/whatsapp') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/whatsapp" element={<WhatsAppPage />} />
        <Route path="/whatsapp/:tab" element={<WhatsAppPage />} />
      </Routes>
    </MemoryRouter>,
  );

const template = (p: Partial<WaSaveTemplate>): WaSaveTemplate => ({
  name: 'camp_invite', language: 'en', category: 'MARKETING', headerFormat: 'NONE', body: 'Hello {{1}}, see you on Sunday.', bodyExamples: { 1: 'Asha' }, buttons: [], ...p,
});

describe('WhatsApp rules on the screen', () => {
  it('finds the phone column, details and opt-in in a CSV', () => {
    const csv = csvToContacts('Mobile,Name,City,Opted In\n"98765 43210","Rao, Asha",Pune,yes\n,No phone,Delhi,no\n9876500000,Bilal,,no\n');
    expect(csv.phoneColumn).toBe('Mobile');
    expect(csv.rows).toHaveLength(2);
    expect(csv.rows[0]).toMatchObject({ phone: '98765 43210', name: 'Rao, Asha', attributes: { city: 'Pune' }, optedIn: true });
    expect(csv.rows[1].optedIn).toBe(false);
    expect(csv.problems[0]).toMatch(/Row 3: no phone/);
    expect(csvToContacts('name\nAsha\n').problems[0]).toMatch(/No phone column/);
  });

  it('checks templates the way Meta does', () => {
    expect(checkTemplate(template({}))).toBeNull();
    expect(checkTemplate(template({ name: 'Camp Invite' }))).toMatch(/lower case/);
    expect(checkTemplate(template({ bodyExamples: {} }))).toMatch(/example for \{\{1\}\}/);
    expect(checkTemplate(template({ body: '{{1}} is invited', bodyExamples: { 1: 'Asha' } }))).toMatch(/start or end/);
    expect(checkTemplate(template({ body: 'Hi {{2}} there', bodyExamples: { 2: 'x' } }))).toMatch(/in order/);
    expect(checkTemplate(template({ headerFormat: 'IMAGE' }))).toMatch(/sample/);
    expect(checkTemplate(template({ buttons: [{ type: 'URL', text: 'Open', url: 'nexeagle.com' }] }))).toMatch(/https/);
    expect(checkTemplate(template({ buttons: [{ type: 'QUICK_REPLY', text: 'A' }, { type: 'URL', text: 'B', url: 'https://x.in' }, { type: 'QUICK_REPLY', text: 'C' }] }))).toMatch(/together/);
  });

  it('knows which values a send needs and how long the reply window has left', () => {
    expect(variablesIn('Hi {{1}} and {{ 2 }} and {{1}}')).toEqual(['1', '2']);
    expect(requiredKeys({ headerVariables: ['1'], bodyVariables: ['1', '2'], urlButtonVariable: true, buttons: [{ type: 'COPY_CODE' }] })).toEqual(['h.1', '1', '2', 'url', 'code']);
    const now = new Date('2026-11-20T10:00:00Z');
    expect(windowLeft('2026-11-20T15:20:00Z', now)).toBe('5 h 20 min left');
    expect(windowLeft('2026-11-20T09:00:00Z', now)).toBeNull();
  });

  it('puts WhatsApp in the menu for people with whatsapp.view', () => {
    const items = visibleGroups(['whatsapp.view']).flatMap(g => g.items.map(i => i.to));
    expect(items).toContain('/whatsapp');
  });
});

describe('WhatsApp inbox', () => {
  it('shows chats and sends a reply inside the 24-hour window', async () => {
    const user = userEvent.setup();
    open();
    const list = await screen.findByRole('complementary', { name: 'Chats' });
    await user.click(await within(list).findByText('Example Hospital A'));
    expect(await screen.findByText('Can you share the pricing?', { selector: '.wa-b-text' })).toBeInTheDocument();
    expect(screen.getByText('Asked about the 50-bed plan last month.')).toBeInTheDocument();
    expect(screen.getByText(/Reply window open/)).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Reply' }), 'Sending it now');
    await user.click(screen.getByRole('button', { name: /^Send$/ }));
    expect(await screen.findByText('Sending it now', { selector: '.wa-b-text' })).toBeInTheDocument();
  });

  it('allows only a template once the window has closed', async () => {
    const user = userEvent.setup();
    open();
    const list = await screen.findByRole('complementary', { name: 'Chats' });
    await user.click(await within(list).findByText('Dr Example Doctor'));
    expect(await screen.findByText(/More than 24 hours since their last message/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Reply' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Send a template' }));
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Template' }), await screen.findByRole('option', { name: /camp_invite/ }));
    expect(screen.getByDisplayValue('Dr')).toBeInTheDocument();   // the first name starts filled in
    const send = screen.getByRole('button', { name: 'Send template' });
    expect(send).toBeDisabled();   // {{2}} still empty
    await user.type(screen.getByRole('textbox', { name: '{{2}}' }), 'Sunday');
    await user.click(send);
    expect(await screen.findByText(/Template · camp_invite/)).toBeInTheDocument();
  });

  it('keeps private notes for the team', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await within(await screen.findByRole('complementary', { name: 'Chats' })).findByText('Dr Example Doctor'));
    await user.click(await screen.findByRole('button', { name: /Note/ }));
    await user.type(screen.getByRole('textbox', { name: 'Private note' }), 'Call him on Monday');
    await user.click(screen.getByRole('button', { name: /Add note/ }));
    expect(await screen.findByText('Call him on Monday')).toBeInTheDocument();
  });
});

describe('WhatsApp templates', () => {
  it('writes a template, previews it with the examples and sends it for approval', async () => {
    const user = userEvent.setup();
    open('/whatsapp/templates');
    expect(await screen.findByText(/Rejected: The format is not allowed/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /New template/ }));
    await user.type(screen.getByPlaceholderText('camp_invite_dec'), 'December Camp');
    expect(screen.getByDisplayValue('december_camp')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /^Message/ }), 'Hello there, the camp is on ');
    await user.click(screen.getByRole('button', { name: /Add a variable/ }));
    await user.type(screen.getByRole('textbox', { name: /^Message/ }), ' at 10.');
    expect(screen.getByText(/Give an example for \{\{1\}\}/)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Send for approval' });
    expect(submit).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Example for {{1}}' }), 'Sunday');
    expect(within(screen.getByLabelText('Preview')).getByText('Hello there, the camp is on Sunday at 10.')).toBeInTheDocument();
    await user.click(submit);
    expect(await screen.findByText('december_camp')).toBeInTheDocument();
  });
});

describe('WhatsApp broadcasts', () => {
  it('shows who gets it and the cost before sending', async () => {
    const user = userEvent.setup();
    open('/whatsapp/broadcasts');
    await user.click(await screen.findByRole('button', { name: /New broadcast/ }));
    await user.type(screen.getByPlaceholderText(/December health camp/), 'Hospital follow-up');
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Template' }), await screen.findByRole('option', { name: /camp_invite/ }));
    await user.type(screen.getByRole('textbox', { name: 'Text' }), 'Sunday');
    await user.click(screen.getByRole('checkbox', { name: /Hospital & doctor leads/ }));
    expect(screen.getByRole('button', { name: 'Send now' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Check audience and cost' }));
    const estimate = await screen.findByRole('status');
    expect(estimate).toHaveTextContent('2 of 2 will get it');
    expect(estimate).toHaveTextContent('₹1.73');
    await user.click(screen.getByRole('button', { name: 'Send now' }));
    expect(await screen.findByText('Hospital follow-up')).toBeInTheDocument();
  });
});

describe('WhatsApp contacts', () => {
  it('needs to know how people agreed before opting them in', async () => {
    const user = userEvent.setup();
    open('/whatsapp/contacts');
    await user.click(await screen.findByRole('button', { name: /Add contact/ }));
    const dialog = screen.getByRole('dialog', { name: 'Add contact' });
    await user.type(within(dialog).getByPlaceholderText(/98765 43210/), '9123456789');
    await user.click(within(dialog).getByRole('radio', { name: 'Opted in' }));
    const save = within(dialog).getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: 'How they agreed' }), 'Signed the camp form');
    await user.click(save);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('+91 91234 56789')).toBeInTheDocument();
  });
});
