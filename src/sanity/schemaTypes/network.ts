// src/sanity/schemaTypes/network.ts
import {defineType, defineField} from 'sanity'
import {ShareIcon} from '@sanity/icons' // or keep CommentIcon if you prefer

export const network = defineType({
  name: 'network',            // <- stays 'network'
  title: 'Network',           // <- label in Studio
  type: 'document',
  icon: ShareIcon,            // optional
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: r => r.required(),
    }),
  ],
  preview: { select: { title: 'title' } },
})
