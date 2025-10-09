import {DocumentTextIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'

export const postType = defineType({
  name: 'post',               // keep the type id as 'post'
  title: 'Member',
  type: 'document',

  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', validation: r => r.required() }),
    defineField({ name: 'description', title: 'Description', type: 'text', rows: 4 }),
 

    defineField({ name: 'datejoined', title: 'Date joined', type: 'date' }), // matches your key
    defineField({ name: 'focalpoint', title: 'Focal point (name)', type: 'string' }), // matches your key
    
    
defineField({
  name: 'emails',
  title: 'Emails',
  description: 'One email per tag. Tip: type an email and press Enter to add it.',
  type: 'array',
  of: [
    // no per-item regex here; let the array-level rule validate
    defineArrayMember({ type: 'string' }),
  ],
  options: { layout: 'tags', sortable: false },
  validation: (Rule) =>
    Rule.custom((arr) => {
      if (!arr || arr.length === 0) return true
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      for (const raw of arr) {
        const v = String(raw || '').trim()
        if (!v) return 'Remove empty email tags.'
        if (!emailRe.test(v)) {
          return `Invalid email: “${raw}”. Tip: one email per tag (press Enter).`
        }
      }
      return true
    }).unique(), // ensure no duplicates
}),




    defineField({
      name: 'country',
      title: 'Country',
      type: 'reference',
      to: [{ type: 'country' }],
      validation: r => r.required(),
    }),

     defineField({
      name: 'website',
      title: 'Website',
      type: 'url',
      description: 'Official website for this entry',
      validation: r =>
        r.uri({
          allowRelative: false,
          scheme: ['http', 'https'],
        }),
    }),


    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'Submitted', value: 'submitted' },
          { title: 'Declined', value: 'declined' },
          { title: 'Published', value: 'published' },
        ],
        layout: 'radio',
      },
      initialValue: 'submitted',
      validation: r => r.required(),
    }),
  ],

  preview: {
    select: {
      title: 'title',
      status: 'status',
    
    },
    prepare({ title, status }) {
      const statusCap = status ? status.charAt(0).toUpperCase() + status.slice(1) : ''
      const subtitle = [statusCap].filter(Boolean).join(' • ')
      return { title, subtitle }
    },
  },

  orderings: [
    { name: 'datejoinedDesc', title: 'Date joined (new → old)', by: [{ field: 'datejoined', direction: 'desc' }] },
    { name: 'titleAsc', title: 'Title (A → Z)', by: [{ field: 'title', direction: 'asc' }] },
  ],
})