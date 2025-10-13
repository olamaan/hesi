import {defineType, defineField} from 'sanity'
import {LinkIcon} from '@sanity/icons'

export const memberParticipation = defineType({
  name: 'memberParticipation',
  title: 'Member Participation',
  type: 'document',
  icon: LinkIcon,

  fields: [
    // one-to-one link to a Member (your "post" type)
    defineField({
      name: 'member',
      title: 'Member',
      type: 'reference',
      to: [{ type: 'post' }],
      validation: r => r.required(),
    }),

    // OPTIONAL one-to-one links (pick any that apply)
    defineField({
      name: 'actionGroup',
      title: 'Action Group',
      type: 'reference',
      to: [{ type: 'actionGroup' }],
    }),
    defineField({
      name: 'forum',
      title: 'Forum',
      type: 'reference',
      to: [{ type: 'forum' }],
    }),
    defineField({
      name: 'priorityArea',
      title: 'Priority Area',
      type: 'reference',
      to: [{ type: 'priorityArea' }],
    }),

        defineField({
      name: 'network',
      title: 'Networking Forum',
      type: 'reference',
      to: [{ type: 'network' }],
    }),

    // (optional) free text about the participation
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'text',
      rows: 3,
    }),
  ],

  // Require at least one of actionGroup / forum / priorityArea
  validation: (Rule) =>
    Rule.custom((doc: any) => {
      if (doc.actionGroup || doc.forum || doc.priorityArea) return true
      return 'Pick at least one: Action Group, Forum, or Priority Area'
    }),

  // Prevent duplicate rows for the exact same combo (member + chosen link)
  // (Three separate guards, evaluated only if the field is present)
  __experimental_actions: ['create', 'update', 'publish', 'delete'],
  preview: {
    select: {
      member: 'member.title',
      ag: 'actionGroup.title',
      fo: 'forum.title',
      pa: 'priorityArea.title',
       nt: 'network.title',
    },
    prepare(sel) {
      const via = sel.ag || sel.fo || sel.pa || sel.nt || '—'
      return {
        title: sel.member || '(Member)',
        subtitle: `via ${via}`,
      }
    },
  },
})
