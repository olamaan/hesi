// src/sanity/schemaTypes/priorityMembership.ts
import {defineType, defineField} from 'sanity'
import {LinkIcon} from '@sanity/icons'
import type { SanityClient } from '@sanity/client'

type PMDoc = {
  _id?: string
  post?: { _ref?: string }
  priorityArea?: { _ref?: string }
}

export const priorityMembership = defineType({
  name: 'priorityMembership',
  title: 'Priority Membership',
  type: 'document',
  icon: LinkIcon,

  validation: (Rule) =>
    Rule.custom(async (rawDoc, context) => {
      const doc = rawDoc as PMDoc
      const postId = doc.post?._ref
      const areaId = doc.priorityArea?._ref
      if (!postId || !areaId) return true

      // Type the schema context’s getClient without using `any`
      const client = (context as unknown as {
        getClient: (opts: { apiVersion: string }) => SanityClient
      }).getClient({ apiVersion: '2024-10-01' })

      const exists = await client.fetch<number>(
        'count(*[_type=="priorityMembership" && post._ref==$p && priorityArea._ref==$a && _id != $id])',
        { p: postId, a: areaId, id: doc._id }
      )

      return exists > 0
        ? 'This university is already a member of that Priority Area.'
        : true
    }),

  fields: [
    defineField({
      name: 'post',
      title: 'University',
      type: 'reference',
      to: [{ type: 'post' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'priorityArea',
      title: 'Priority Area',
      type: 'reference',
      to: [{ type: 'priorityArea' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'contribution',
      title: 'Contribution (what they do in this Priority Area)',
      type: 'text',
      rows: 5,
      validation: (Rule) => Rule.required().min(10),
    }),
    defineField({ name: 'since', title: 'Member since', type: 'date' }),
    defineField({ name: 'website', title: 'Related link', type: 'url' }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      initialValue: 'submitted',
      options: {
        list: [
          { title: 'Submitted', value: 'submitted' },
          { title: 'Published', value: 'published' },
          { title: 'Declined', value: 'declined' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
  ],

  preview: {
    select: {
      post: 'post.title',
      area: 'priorityArea.title',
      status: 'status',
    },
    prepare(sel) {
      return {
        title: sel.post || '(University)',
        subtitle: `${sel.area || '(Priority Area)'} — ${sel.status || ''}`,
      }
    },
  },
})
