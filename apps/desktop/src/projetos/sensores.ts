import { KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type KeyboardSensorOptions, type PointerSensorOptions } from "@dnd-kit/core";
import type { PointerEvent as EventoPonteiro } from "react";

/**
 * Mouse e caneta pegam na hora (basta mexer 4 px). O dedo fica com o sensor de toque,
 * que espera 150 ms parado: assim, deslizar rápido continua rolando a tela.
 */
class PonteiroSemDedo extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: (evento: EventoPonteiro, opcoes: PointerSensorOptions) =>
        evento.nativeEvent.pointerType !== "touch" && PointerSensor.activators[0].handler(evento, opcoes),
    },
  ];
}

/** Os sensores de arrastar usados nos quadros (tarefas e ideias). */
export function useSensoresArrastar(teclado: KeyboardSensorOptions) {
  return useSensors(
    useSensor(PonteiroSemDedo, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, teclado),
  );
}
