// src/sanity/schemaTypes/memberParticipation.ts
import {defineType, defineField} from 'sanity'
import {LinkIcon} from '@sanity/icons'

export const memberParticipation = defineType({
  name: 'memberParticipation',
  title: 'Member Participation',
  type: 'document',
  icon: LinkIcon,
  fields: [
    defineField({
      name: 'member',
      title: 'Member',
      type: 'reference',
      to: [{type: 'post'}],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'forum',
      title: 'Forum',
      type: 'reference',
      to: [{type: 'forum'}],
    }),
    defineField({
      name: 'network',
      title: 'Network',
      type: 'reference',
      to: [{type: 'network'}],
    }),
    defineField({
      name: 'priorityArea',
      title: 'Priority Area',
      type: 'reference',
      to: [{type: 'priorityArea'}],
    }),
    defineField({
      name: 'actionGroup',
      title: 'Action Group',
      type: 'reference',
      to: [{type: 'actionGroup'}],
    }),
  ],

  // Ensure at least one of the four activity refs is selected
  validation: (Rule) =>
    Rule.custom((_value, context) => {
      type Ref = { _ref?: string } | undefined
      type Doc = {
        forum?: Ref
        network?: Ref
        priorityArea?: Ref
        actionGroup?: Ref
      }
      const doc = (context as {document?: Doc}).document
      const hasAny =
        !!(doc?.forum?._ref ||
           doc?.network?._ref ||
           doc?.priorityArea?._ref ||
           doc?.actionGroup?._ref)

      return hasAny || 'Select at least one activity (Forum / Network / Priority Area / Action Group).'
    }),

  preview: {
    select: {
      memberTitle: 'member->title',
      forum: 'forum->title',
      network: 'network->title',
      pa: 'priorityArea->title',
      action: 'actionGroup->title',
    },
    prepare(sel) {
      const parts = [
        sel.forum && `Forum: ${sel.forum}`,
        sel.network && `Network: ${sel.network}`,
        sel.pa && `Priority: ${sel.pa}`,
        sel.action && `Action: ${sel.action}`,
      ].filter(Boolean)
      return {
        title: sel.memberTitle || 'Member',
        subtitle: parts.join(' • ') || 'No activity selected',
      }
    },
  },
})
