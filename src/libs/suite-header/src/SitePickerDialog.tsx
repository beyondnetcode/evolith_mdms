import { Button, ModalDialog } from '@sil/ui';
import { useState } from 'react';
import { sitePickerTexts } from './header-texts.ts';

/** Una sede elegible: el perfil y su etiqueta ya compuesta («Jefatura · Callao»). */
export interface SiteOption {
  readonly profileId: string;
  readonly label: string;
}

interface Props {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  /** Sigla del sistema: «Elige la sede de SIL». */
  readonly systemCode: string;
  readonly options: readonly SiteOption[];
  /** Perfil vigente de la sesión: llega preseleccionado. */
  readonly currentId: string;
  /** «Abrir SIL» desde la suite; «Cambiar» desde SIL (anexo A1 §4). */
  readonly actionLabel: string;
  readonly onConfirm: (profileId: string) => void;
}

/**
 * S-03 — Elige la sede de un sistema. Diálogo básico con botones de opción (una de pocas opciones
 * visibles). Está CONDICIONADO: ADR-0156 §2.6 y ADR-0245 D7 bloquean el cambio de perfil hasta que
 * UMS publique el identificador de perfil (G-102, G-107). El contenido solo existe abierto: cada
 * apertura empieza con el perfil vigente.
 */
export function SitePickerDialog({ isOpen, onClose, ...rest }: Props) {
  return (
    <ModalDialog open={isOpen} onClose={onClose} title={sitePickerTexts(rest.systemCode).title}>
      {isOpen && <Content onClose={onClose} {...rest} />}
    </ModalDialog>
  );
}

function Content({ onClose, systemCode, options, currentId, actionLabel, onConfirm }: Omit<Props, 'isOpen'>) {
  const [chosen, setChosen] = useState(currentId);
  const texts = sitePickerTexts(systemCode);
  return (
    <form
      method="dialog"
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm(chosen);
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-body-medium">{texts.supportText}</p>
      <fieldset className="flex flex-col">
        <legend className="mb-1 text-title-small">{texts.legend}</legend>
        {options.map((option) => (
          <label key={option.profileId} className="state-layer flex min-h-12 cursor-pointer items-center gap-3 rounded-xs px-2 text-body-large">
            <input
              type="radio"
              name={`perfil-${systemCode.toLowerCase()}`}
              value={option.profileId}
              checked={chosen === option.profileId}
              onChange={() => setChosen(option.profileId)}
              className="size-5 accent-primary"
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit">{actionLabel}</Button>
      </div>
    </form>
  );
}
