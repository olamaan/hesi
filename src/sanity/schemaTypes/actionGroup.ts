import {defineType, defineField} from 'sanity'
import {UsersIcon} from '@sanity/icons'

export const actionGroup = defineType({
  name: 'actionGroup',
  title: 'Action Group',
  type: 'document',
  icon: UsersIcon,
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', validation: r => r.required() }),
  ],
  preview: { select: { title: 'title' } },
})
