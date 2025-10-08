import ExistingPriorityForm from '@/components/ExistingPriorityForm'

export default function ExistingPriorityApply({
  searchParams,
}: {
  searchParams: { [k: string]: string | string[] | undefined }
}) {
  // For dev: we accept either ?postId=... or ?token=...
  const token = Array.isArray(searchParams.token) ? searchParams.token[0] : (searchParams.token || '')
  const postId = Array.isArray(searchParams.postId) ? searchParams.postId[0] : (searchParams.postId || '')
  const idOrToken = postId || token

  if (!idOrToken) {
    return <p className="alert alert--warn">Missing token or postId in the URL.</p>
  }

  return (
    <section>
      <h2>Edit Priority Area memberships</h2>
      <ExistingPriorityForm postIdOrToken={idOrToken} />
    </section>
  )
}
