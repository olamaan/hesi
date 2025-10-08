import {defineType, defineField} from 'sanity'
import {TagIcon} from '@sanity/icons'

export const priorityArea = defineType({
  name: 'priorityArea',
  title: 'Priority Area',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({ name: 'title', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'description', type: 'text', rows: 4 }),
  ],
  preview: {
    select: {title: 'title', description: 'description'},
    prepare(sel) {
      return { title: sel.title, subtitle: sel.description?.slice(0, 80) }
    }
  }
})
