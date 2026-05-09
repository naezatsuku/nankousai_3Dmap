export type ExhibitType = 'class' | 'food' | 'band' | 'special' | 'cafeteria'

export interface Exhibit {
  id: string
  name: string
  class_label?: string
  type: ExhibitType
  room_object: string
  room_display: string
  floor: number
  wait_minutes: number
  is_active: boolean
  day: string
  thumbnail_url?: string
}
