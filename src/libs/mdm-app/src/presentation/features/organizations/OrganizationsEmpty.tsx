import { Button, buttonStyles } from '@sil/ui';
import { Link } from 'react-router';
import { hasFilters, type OrganizationSearch } from '../../../domain/organization-search.ts';
import { EmptyState } from '../../common/EmptyState.tsx';
import { NEW_ORGANIZATION_PATH } from '../../mdm-roots.ts';
import { ORGANIZATIONS_TEXTS as T } from './texts.ts';

interface Props {
  readonly search: OrganizationSearch;
  readonly canRegister: boolean;
  readonly onSearchByIdentifier: () => void;
  readonly onClear: () => void;
}

/** Alta con el identificador ya escrito (WCAG 3.3.7, AC-16). */
function newOrganizationLink(search: OrganizationSearch): string {
  if (search.identifier === null) return NEW_ORGANIZATION_PATH;
  const { countryCode, schemeCode, value } = search.identifier;
  return `${NEW_ORGANIZATION_PATH}?${new URLSearchParams({ pais: countryCode, esquema: schemeCode, valor: value }).toString()}`;
}

/** Los cuatro vacíos de P-MDM-01 (UX-MDM-001 §6.4). Solo se anuncia si viene de buscar o filtrar. */
export function OrganizationsEmpty({ search, canRegister, onSearchByIdentifier, onClear }: Props) {
  const register = canRegister ? (
    <Link to={newOrganizationLink(search)} className={buttonStyles('tonal')}>
      {T.newOrganization}
    </Link>
  ) : undefined;
  if (search.identifier !== null) {
    return <EmptyState icon="search" announce title={T.emptyIdentifier(search.identifier.schemeCode, search.identifier.value)} actions={register} />;
  }
  if (search.roleTypeCode !== null || search.status !== null) {
    return <EmptyState icon="tune" announce title={T.emptyFilters} actions={<Button onClick={onClear}>{T.clearFilters}</Button>} />;
  }
  if (search.text !== '') {
    return (
      <EmptyState
        icon="search"
        announce
        title={T.emptyText(search.text)}
        actions={
          <>
            <Button onClick={onSearchByIdentifier}>{T.identifierToggle}</Button>
            {register}
          </>
        }
      >
        {T.emptyTextHelp}
      </EmptyState>
    );
  }
  return <EmptyState icon="storage" announce={hasFilters(search)} title={T.emptyMaster} actions={register} />;
}
