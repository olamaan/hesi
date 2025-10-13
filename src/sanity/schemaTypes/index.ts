import { type SchemaTypeDefinition } from 'sanity'

import {blockContentType} from './blockContentType'
import {categoryType} from './categoryType'
import {postType} from './postType'
import {authorType} from './authorType'
import {priorityArea} from './priorityArea'
//import {priorityMembership} from './priorityMembership'

 import {actionGroup} from './actionGroup'
import {forum} from './forum'
import {network} from './network'

 
import {regionType} from './region'
import {countryType} from './country'


export const schema: { types: SchemaTypeDefinition[] } = {
  types: [blockContentType, categoryType, postType, authorType, regionType, countryType,  priorityArea,actionGroup,
    forum,
    network,
    ],
}
