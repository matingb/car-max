import { describe, it, expect, vi } from "vitest";
import { arregloFormularioService } from "./arregloFormularioService";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("arregloFormularioService", () => {
  describe("validateTerminadoRequiredFields", () => {
    it("retorna ok: true si no hay formulario asociado", async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const result = await arregloFormularioService.validateTerminadoRequiredFields(supabase, "a1");

      expect(result).toEqual({ ok: true });
    });

    it("bloquea si faltan campos obligatorios en el formulario custom", async () => {
      const mockDetalleFormRows = [
        {
          config_id: "form-1",
          metadata: [
            {
              title: "Sección 1",
              inputs: [{ title: "Firma", value: "" }],
            },
          ],
        },
      ];

      const mockFormularioRow = {
        metadata: [
          {
            title: "Sección 1",
            inputs: [{ key: "firma", label: "Firma", required: true }],
          },
        ],
      };

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === "detalle_form_custom") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: mockDetalleFormRows, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "formularios") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockFormularioRow, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      const result = await arregloFormularioService.validateTerminadoRequiredFields(supabase, "a1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(400);
        expect(result.error).toContain("Firma");
      }
    });

    it("retorna ok: true si todos los campos obligatorios están completos", async () => {
      const mockDetalleFormRows = [
        {
          config_id: "form-1",
          metadata: [
            {
              title: "Sección 1",
              inputs: [{ title: "Firma", value: "Juan Perez" }],
            },
          ],
        },
      ];

      const mockFormularioRow = {
        metadata: [
          {
            title: "Sección 1",
            inputs: [{ key: "firma", label: "Firma", required: true }],
          },
        ],
      };

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === "detalle_form_custom") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: mockDetalleFormRows, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "formularios") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockFormularioRow, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      const result = await arregloFormularioService.validateTerminadoRequiredFields(supabase, "a1");

      expect(result).toEqual({ ok: true });
    });
  });

  describe("upsertDetalleFormulario", () => {
    it("valida costo negativo", async () => {
      const supabase = {} as SupabaseClient;
      const result = await arregloFormularioService.upsertDetalleFormulario(supabase, "a1", {
        costo: -10,
        metadata: [],
      });

      expect(result.error).toBe("Costo inválido en detalle de formulario");
      expect(result.status).toBe(400);
    });

    it("actualiza detalle si ya existe registro previo", async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [{ id: "df1" }], error: null }),
              }),
            }),
          }),
          update: updateMock,
        }),
      } as unknown as SupabaseClient;

      const result = await arregloFormularioService.upsertDetalleFormulario(supabase, "a1", {
        formulario_id: "form-new",
        costo: 350,
        metadata: [],
      });

      expect(result.error).toBeNull();
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          costo: 350,
          config_id: "form-new",
        })
      );
    });
  });
});
