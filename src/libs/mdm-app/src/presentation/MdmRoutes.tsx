import { Navigate, Route, Routes } from 'react-router';
import { NotFound } from './common/NotFound.tsx';
import { OrganizationsPage } from './features/organizations/OrganizationsPage.tsx';
import { PartyPage } from './features/party/PartyPage.tsx';
import { NewOrganizationPage } from './features/registration/NewOrganizationPage.tsx';
import { RoleTypesPage } from './features/role-types/RoleTypesPage.tsx';
import { GeographyPage } from './features/geography/GeographyPage.tsx';
import { CountryDetailPage } from './features/geography/CountryDetailPage.tsx';
import { PlaceDetailPage } from './features/geography/PlaceDetailPage.tsx';

/**
 * Rutas de MDM, relativas a `/mdm` (D-026, SU-MDM-13): `/mdm/organizaciones` (P-MDM-01),
 * `/mdm/organizaciones/nueva` (P-MDM-03), `/mdm/organizaciones/{id}` (P-MDM-02), `/mdm/tipos-de-rol` (P-MDM-04,
 * D-046) y `/mdm/geografia` con su ficha de lugar. Una dirección desconocida dentro de MDM es el 404 de MDM.
 */
export function MdmRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="organizaciones" replace />} />
      <Route path="organizaciones" element={<OrganizationsPage />} />
      <Route path="organizaciones/nueva" element={<NewOrganizationPage />} />
      <Route path="organizaciones/:partyId" element={<PartyPage />} />
      <Route path="tipos-de-rol" element={<RoleTypesPage />} />
      <Route path="geografia" element={<GeographyPage />} />
      <Route path="geografia/paises/:countryCode" element={<CountryDetailPage />} />
      <Route path="geografia/lugares/:placeId" element={<PlaceDetailPage />} />
      <Route path="*" element={<NotFound message="La dirección que abriste no existe en MDM." />} />
    </Routes>
  );
}
