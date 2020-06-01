import { useState } from 'react'

export function useForm() {
  // TODO
}

function useFormField<T>(config: unknown) {
  const [value, setValue] = useState<T>()
  return {
    value,
    onChange: setValue,
  }
}
