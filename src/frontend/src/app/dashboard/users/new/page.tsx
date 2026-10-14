import {UserForm} from "@/modules/users/components/user-form";

export default function NewUserPage() {
    return (
        <div>
            <h1>Create user</h1>
            <UserForm mode="create"/>
        </div>
    );
}
