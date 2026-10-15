import { useSyncExternalStore } from 'react'
import { gate, type GateState } from './gate-state'

/** Trạng thái cổng hiện tại; render phía server hoặc khi không có 3D luôn là `open`. */
export function useGateState(): GateState {
  return useSyncExternalStore(gate.subscribe, gate.getState, () => 'open')
}
