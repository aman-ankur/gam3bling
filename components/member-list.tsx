import { Avatar } from "@/components/avatar";

type Member = {
  name: string;
  initials: string;
  status: string;
  tone?: string;
};

type MemberListProps = {
  members: Member[];
};

export function MemberList({ members }: MemberListProps) {
  return (
    <ul aria-label="Room members" className="member-grid">
      {members.map((member) => (
        <li key={member.name}>
          <Avatar initials={member.initials} tone={member.tone} />
          <b>{member.name}</b>
          <small>{member.status}</small>
        </li>
      ))}
    </ul>
  );
}
