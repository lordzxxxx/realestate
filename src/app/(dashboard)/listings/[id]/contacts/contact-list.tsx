'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactForm } from './contact-form';
import { deleteListingContactAction } from './actions';
import type { Database } from '@/types/database';

type Contact = Database['public']['Tables']['listing_contacts']['Row'];

const TYPE_LABELS: Record<Contact['contact_type'], string> = {
  OWNER: 'Owner',
  KEY_HOLDER: 'Key Holder',
  REPRESENTATIVE: 'Representative',
};

export function ContactList({ listingId, contacts }: { listingId: string; contacts: Contact[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = (contactId: string) => {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteListingContactAction(listingId, contactId);
      if (result?.error) setDeleteError(result.error);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Private Contacts</h2>
        {!adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add Contact
          </Button>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Owner, key-holder, and representative details are private — never shown on the public listing.
      </p>

      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

      {adding && (
        <div className="rounded-md border border-slate-200 p-4">
          <ContactForm listingId={listingId} onDone={() => setAdding(false)} />
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="mt-2 text-xs text-slate-400 hover:text-slate-600"
          >
            Cancel
          </button>
        </div>
      )}

      {contacts.length === 0 && !adding && (
        <p className="rounded-md border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
          No private contacts added yet.
        </p>
      )}

      <div className="space-y-3">
        {contacts.map((contact) =>
          editingId === contact.id ? (
            <div key={contact.id} className="rounded-md border border-slate-200 p-4">
              <ContactForm
                listingId={listingId}
                contactId={contact.id}
                defaultValues={{
                  contact_type: contact.contact_type,
                  name: contact.name,
                  email: contact.email ?? '',
                  phone: contact.phone ?? '',
                  messenger: contact.messenger ?? '',
                  company: contact.company ?? '',
                  viewing_instructions: contact.viewing_instructions ?? '',
                  access_instructions: contact.access_instructions ?? '',
                  internal_notes: contact.internal_notes ?? '',
                  commission_info: contact.commission_info ?? '',
                }}
                onDone={() => setEditingId(null)}
              />
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="mt-2 text-xs text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div key={contact.id} className="rounded-md border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="mb-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {TYPE_LABELS[contact.contact_type]}
                  </span>
                  <p className="text-sm font-medium text-slate-900">{contact.name}</p>
                  <p className="text-xs text-slate-500">
                    {[contact.phone, contact.email, contact.company].filter(Boolean).join(' · ') || '—'}
                  </p>
                  {contact.viewing_instructions && (
                    <p className="mt-1 text-xs text-slate-500">Viewing: {contact.viewing_instructions}</p>
                  )}
                  {contact.access_instructions && (
                    <p className="text-xs text-slate-500">Access: {contact.access_instructions}</p>
                  )}
                  {contact.internal_notes && (
                    <p className="mt-1 text-xs italic text-slate-400">{contact.internal_notes}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingId(contact.id)}
                    className="p-1 text-slate-400 hover:text-slate-900"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(contact.id)}
                    className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
