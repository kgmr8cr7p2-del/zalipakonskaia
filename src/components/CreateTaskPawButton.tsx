"use client";

export function CreateTaskPawButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="create-task-paw-zone">
      <span className="create-task-mini-ribbon" aria-hidden="true" />
      <span className="create-task-mini-clip" aria-hidden="true" />
      <button className="create-task-mini-card" type="button" onClick={onClick} aria-label="Создать задачу">
        <img src="/lanyard/create-task-front.svg" alt="" />
      </button>
    </div>
  );
}
