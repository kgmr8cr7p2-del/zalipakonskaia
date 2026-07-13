"use client";

import dynamic from "next/dynamic";

const Lanyard = dynamic(() => import("@/components/Lanyard/Lanyard"), { ssr: false });

export function CreateTaskPawButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="create-task-paw-zone">
      <div className="create-task-lanyard">
        <Lanyard position={[0, 0, 24]} gravity={[0, -40, 0]} onActivate={onClick} />
      </div>
      <button className="button create-task-keyboard-trigger" type="button" onClick={onClick}>
        Создать задачу
      </button>
    </div>
  );
}
