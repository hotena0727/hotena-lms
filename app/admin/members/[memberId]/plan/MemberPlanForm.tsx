<div className="mt-8 flex flex-wrap gap-3">
  <AdminButton
    onClick={handleSave}
    disabled={saving}
    variant="primary"
  >
    {saving ? "저장 중..." : "플랜 저장"}
  </AdminButton>

  <AdminButton onClick={() => router.back()}>
    취소
  </AdminButton>
</div>