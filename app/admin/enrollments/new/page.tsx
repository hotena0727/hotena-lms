const members = [
  { id: 1, name: "김선우", email: "sunwoo@example.com", plan: "vip" },
  { id: 2, name: "이하나", email: "hana@example.com", plan: "pro" },
  { id: 3, name: "박민수", email: "minsu@example.com", plan: "free" },
  { id: 4, name: "정유진", email: "yujin@example.com", plan: "standard" },
];

const courses = [
  { id: 1, title: "일본어 입문 패키지", level: "입문", status: "open" },
  { id: 2, title: "기초 문법 완성", level: "초급", status: "open" },
  { id: 3, title: "JLPT N3 집중반", level: "N3", status: "coming" },
  { id: 4, title: "회화 훈련 베이직", level: "회화", status: "draft" },
];

export default function AdminEnrollmentNewPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <p className="text-sm font-semibold text-slate-500">수강 등록</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">
          회원에게 강의 열어주기
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          특정 회원에게 특정 강의를 등록하고, 시작일과 만료일을 설정하는 화면입니다.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              회원 선택
            </label>
            <select className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none">
              <option>회원을 선택하세요</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} / {member.email} / {member.plan}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              강의 선택
            </label>
            <select className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none">
              <option>강의를 선택하세요</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title} / {course.level} / {course.status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              시작일
            </label>
            <input
              type="date"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              만료일
            </label>
            <input
              type="date"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              상태
            </label>
            <select className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none">
              <option value="active">active</option>
              <option value="trial">trial</option>
              <option value="completed">completed</option>
              <option value="expired">expired</option>
              <option value="cancelled">cancelled</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              초기 진도율
            </label>
            <input
              type="number"
              min={0}
              max={100}
              placeholder="0"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            관리자 메모
          </label>
          <textarea
            rows={4}
            placeholder="수강 등록 사유나 안내 메모를 남겨주세요."
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
            수강 등록 저장
          </button>
          <button className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
            취소
          </button>
        </div>
      </section>
    </div>
  );
}