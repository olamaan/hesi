import {defineType, defineField} from 'sanity'
import {CommentIcon} from '@sanity/icons'

export const forum = defineType({
  name: 'forum',
  title: 'Forum',
  type: 'document',
  icon: CommentIcon,
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', validation: r => r.required() }),
  ],
  preview: { select: { title: 'title' } },
})
