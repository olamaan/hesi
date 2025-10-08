import {defineField, defineType} from 'sanity'

export const regionType = defineType({
  name: 'region',
  title: 'Region',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: r => r.required()}),
    // optional short code, e.g., "CAR", "PAC", "AIS"
    defineField({name: 'code', title: 'Code', type: 'string'}),
  ],
})
