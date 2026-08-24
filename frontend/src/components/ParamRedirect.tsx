import { Navigate, useParams } from 'react-router-dom'

export function ParamRedirect({ build }: { build: (params: Record<string, string | undefined>) => string }) {
  const params = useParams()
  return <Navigate to={build(params)} replace />
}
