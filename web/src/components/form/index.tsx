import { useState } from "react"

export function useForm() {

}

function useFormField<T>(config: {

}) {
  const [value, setValue] = useState<T>()
  return {
    value,
    onChange: setValue
  }
}


