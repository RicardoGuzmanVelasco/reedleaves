// Current editorial appearance change. Earlier appearance migrations remain frozen.
export const PRODUCTIVITY_INTEREST_APPEARANCE_SQL=`
UPDATE genres SET emoji='🔥',color='#E85C22' WHERE id='productivity';
`;
