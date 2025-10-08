import {defineField, defineType} from 'sanity'

export const countryType = defineType({
  name: 'country',
  title: 'Country',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: r => r.required()}),

    defineField({
      name: 'region',
      title: 'Region',
      type: 'reference',
      to: [{ type: 'region' }],
      validation: r => r.required(), // make it required once backfill is done
    }),


   
  ],
})
