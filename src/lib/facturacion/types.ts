export type DocumentoFiscalTipo = 80 | 86 | 96 | 99;

export type CondicionIvaReceptorId =
  | 1 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 13 | 15 | 16;

export type FacturacionAmbiente = "HOMOLOGACION" | "PRODUCCION";
export type CondicionIvaEmisor = "MONOTRIBUTISTA" | "RESPONSABLE_INSCRIPTO";
export type FacturaClase = "A" | "B" | "C" | "M";
export type DocumentoFiscalClase = "FACTURA" | "NOTA_CREDITO" | "NOTA_DEBITO";
export type FacturaOrigenTipo = "ARREGLO" | "VENTA";
export type TratamientoIva = "GRAVADO" | "EXENTO" | "NO_GRAVADO";

export type FacturaElectronicaEstado =
  | "BORRADOR" | "LISTA" | "ENVIANDO" | "AUTORIZADA" | "RECHAZADA" | "INCIERTA";
export type FacturaConcepto = 1 | 2 | 3;
export type FacturaLineaOrigen = "SERVICIO" | "FORMULARIO" | "REPUESTO" | "VENTA" | "AJUSTE";

export type PerfilFiscalCliente = {
  clienteId: string | null;
  nombre: string;
  domicilio: string | null;
  tipoDocumento: DocumentoFiscalTipo | null;
  numeroDocumento: string | null;
  condicionIvaReceptorId: CondicionIvaReceptorId | null;
  fceMipymeAlcanzado?: boolean;
};

export type FacturaLinea = {
  ordinal: number;
  origen: FacturaLineaOrigen;
  sourceId?: string | null;
  descripcion: string;
  codigo?: string | null;
  cantidad: number;
  importeUnitario: number;
  subtotal: number;
  tratamientoIva?: TratamientoIva;
  ivaAlicuotaId?: number | null;
  ivaAlicuota?: number;
  importeNeto?: number;
  importeIva?: number;
  importeTotal?: number;
  snapshot?: Record<string, unknown>;
};

export type FacturaTotales = {
  netoGravado: number;
  noGravado: number;
  exento: number;
  iva: number;
  tributos: number;
  otrosImpuestosNacionales: number;
  total: number;
};

export type FacturaFechaInput = {
  fechaComprobante: string;
  fechaServicioDesde?: string | null;
  fechaServicioHasta?: string | null;
  fechaVencimientoPago?: string | null;
};

export type FacturaElectronicaResumen = {
  id: string;
  estado: FacturaElectronicaEstado;
  ambiente: FacturacionAmbiente;
  origenTipo: FacturaOrigenTipo;
  origenId: string;
  documentoTipo: DocumentoFiscalClase;
  claseComprobante: FacturaClase;
  tipoComprobante: number;
  puntoVenta: number;
  numeroComprobante: number | null;
  cae: string | null;
  caeVencimiento: string | null;
  total: number;
  concepto: FacturaConcepto;
  fechaComprobante: string;
  receptorNombre: string;
  receptorDocumento: string | null;
  createdAt?: string;
  errorCodigo?: string | null;
  errorMensaje?: string | null;
};

export type FacturaElectronicaDetalle = FacturaElectronicaResumen & {
  emisorSnapshot: Record<string, unknown>;
  receptorSnapshot: Record<string, unknown>;
  fechas: FacturaFechaInput;
  condicionVenta: string;
  moneda: "PES";
  totales: FacturaTotales;
  lineas: FacturaLinea[];
  documentoAsociado: FacturaElectronicaResumen | null;
  documentosAjuste: FacturaElectronicaResumen[];
  intentos: Array<{
    id: string;
    numeroIntento: number;
    estado: string;
    errorCodigo: string | null;
    errorMensaje: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  origenExterno: boolean;
  pdfDisponible: boolean;
};

export type FacturacionConfiguracionPublica = {
  razonSocial: string;
  nombreFantasia: string | null;
  cuit: string;
  condicionIvaEmisor: CondicionIvaEmisor;
  domicilio: string;
  ingresosBrutos: string | null;
  inicioActividades: string;
  puntoVenta: number;
  habilitada: boolean;
  ambiente: FacturacionAmbiente;
  credenciales: {
    configuradas: boolean;
    certificadoNombre: string | null;
    clavePrivadaNombre: string | null;
    fingerprintSha256: string | null;
    vencimiento: string | null;
    actualizadasAt: string | null;
  };
};

export type FacturacionPreflight = {
  puedeEmitir: boolean;
  configuracionCompleta: boolean;
  origenListo: boolean;
  diferenciasTotal: boolean;
  fceBloqueada: boolean;
  mensaje?: string;
  emisor?: Pick<FacturacionConfiguracionPublica,
    "razonSocial" | "cuit" | "puntoVenta" | "ambiente" | "condicionIvaEmisor">;
  receptor: PerfilFiscalCliente;
  concepto: FacturaConcepto;
  documentoTipo: DocumentoFiscalClase;
  claseComprobante: FacturaClase;
  tipoComprobante: number;
  lineas: FacturaLinea[];
  totales: FacturaTotales;
  total: number;
  precioFinal: number;
  fechasDefault: FacturaFechaInput;
};

export type FacturasPaginadas = {
  items: FacturaElectronicaResumen[];
  page: number;
  pageSize: number;
  total: number;
};

export const ALICUOTAS_IVA_ARCA = [
  { id: 3, label: "0%", porcentaje: 0 },
  { id: 9, label: "2,5%", porcentaje: 2.5 },
  { id: 8, label: "5%", porcentaje: 5 },
  { id: 4, label: "10,5%", porcentaje: 10.5 },
  { id: 5, label: "21%", porcentaje: 21 },
  { id: 6, label: "27%", porcentaje: 27 },
] as const;

export const CONDICIONES_IVA_RECEPTOR: Array<{ id: CondicionIvaReceptorId; label: string }> = [
  { id: 1, label: "Responsable inscripto" },
  { id: 4, label: "IVA exento" },
  { id: 5, label: "Consumidor final" },
  { id: 6, label: "Monotributista" },
  { id: 15, label: "IVA no alcanzado" },
];

export const TIPOS_DOCUMENTO_FISCAL: Array<{ id: DocumentoFiscalTipo; label: string }> = [
  { id: 99, label: "Consumidor final sin identificar" },
  { id: 96, label: "DNI" },
  { id: 86, label: "CUIL" },
  { id: 80, label: "CUIT" },
];

export const FACTURA_ESTADO_LABEL: Record<FacturaElectronicaEstado, string> = {
  BORRADOR: "Borrador", LISTA: "Lista", ENVIANDO: "Enviando",
  AUTORIZADA: "Autorizada", RECHAZADA: "Rechazada", INCIERTA: "Incierta",
};

export function comprobanteLabel(documento: DocumentoFiscalClase, clase: FacturaClase): string {
  const nombre = documento === "FACTURA"
    ? "Factura"
    : documento === "NOTA_CREDITO" ? "Nota de crédito" : "Nota de débito";
  return `${nombre} ${clase}`;
}
