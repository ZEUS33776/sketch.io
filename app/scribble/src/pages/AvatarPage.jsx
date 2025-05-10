import { useState } from "react";
import AvatarSelect from "../components/AvatarSelect";
import InRoom from "../components/InRoom";
import React, { createContext, useContext } from 'react';
export const PageContext = createContext({});
const AvatarPage = () => {
    
    const handlePrivateRoomClick = () => {
        console.log("hii")
        setCurrentPage(prev => 
            (prev==="AvatarPage"?"InRoomPage":"AvatarPage")
        )
    }
    const handleJoinRoomClick = () => {
        console.log("hii2")
        setCurrentPage("InRoomPage")
    }
    const [currentPage,setCurrentPage]=useState("AvatarPage")
    return (
        <PageContext.Provider value={{currentPage,setCurrentPage}}>
    <>
        {(currentPage==="AvatarPage")?
        <div className="flex flex-col items-center justify-center ">
        <h3 className="text-8xl text-gray-900 font-bold font-heading mt-12">sketch.io</h3>
        <div className="flex justify-center h-[80vh] items-center">
            
            <AvatarSelect handlePrivateClick={handlePrivateRoomClick} handleJoinRoomClick={handleJoinRoomClick}/>
            </div>
            </div > :<InRoom />
            
            }
            </>
            </PageContext.Provider>
    )
    
}
export default AvatarPage