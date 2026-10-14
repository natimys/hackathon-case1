import React from "react";
import ReactDOM from "react-dom/client";
import {BrowserRouter, Navigate, Route, Routes} from "react-router-dom";
import {Providers} from "@/components/providers";
import RootPage from "@/app/page";
import LoginPage from "@/app/login/page";
import DashboardLayout from "@/app/dashboard/layout";
import DashboardPage from "@/app/dashboard/page";
import TicketsPage from "@/app/dashboard/tickets/page";
import NewTicketPage from "@/app/dashboard/tickets/new/page";
import TicketPage from "@/app/dashboard/tickets/[id]/page";
import TechnicianPage from "@/app/dashboard/technician/page";
import BillingPage from "@/app/dashboard/billing/page";
import InvoiceDetailPage from "@/app/dashboard/billing/invoices/[id]/page";
import PropertiesPage from "@/app/dashboard/properties/page";
import CamerasPage from "@/app/dashboard/cameras/page";
import UsersPage from "@/app/dashboard/users/page";
import NewUserPage from "@/app/dashboard/users/new/page";
import EditUserPage from "@/app/dashboard/users/[id]/edit/page";
import "@/app/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <BrowserRouter>
            <Providers>
                <Routes>
                    <Route path="/" element={<RootPage/>}/>
                    <Route path="/login" element={<LoginPage/>}/>
                    <Route path="/dashboard" element={<DashboardLayout/>}>
                        <Route index element={<DashboardPage/>}/>
                        <Route path="tickets" element={<TicketsPage/>}/>
                        <Route path="tickets/new" element={<NewTicketPage/>}/>
                        <Route path="tickets/:id" element={<TicketPage/>}/>
                        <Route path="technician" element={<TechnicianPage/>}/>
                        <Route path="billing" element={<BillingPage/>}/>
                        <Route path="billing/invoices/:id" element={<InvoiceDetailPage/>}/>
                        <Route path="properties" element={<PropertiesPage/>}/>
                        <Route path="cameras" element={<CamerasPage/>}/>
                        <Route path="users" element={<UsersPage/>}/>
                        <Route path="users/new" element={<NewUserPage/>}/>
                        <Route path="users/:id/edit" element={<EditUserPage/>}/>
                    </Route>
                    <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
                </Routes>
            </Providers>
        </BrowserRouter>
    </React.StrictMode>,
);
