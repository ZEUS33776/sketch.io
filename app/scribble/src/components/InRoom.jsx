import { users,target } from "./data"
import { useState } from "react"
import GuessArea from './GuessArea';
import TopPanel from './TopPanel';
import Header from './Header';
import DrawableCanvas from './DrawableCanvas';
import LeaderBoard from './LeaderBoard';
import MainCanvasPage from "../pages/MainCanvasPage";



const InRoom = () => {
    const [currentPage, setCurrentPage] = useState("InRoomPage")
    const handleStartClicked = () => {
        setCurrentPage("CanvasPage")
    }
    
    return (
        
            (currentPage=="InRoomPage") ?
               ( <div>
        <div className="flex flex-col gap-20 h-[100vh] w-[100vw] items-center justify-center ">
            <h3 className="text-8xl text-gray-900 font-bold font-heading mt-12">sketch.io</h3>
            <div className=" flex items-center flex-col ">
                <div className="flex gap-2">
                <input type="text" className="w-[23rem] mb-10 p-2 pl-3 rounded-lg" placeholder="Hover over me to get the link" />
                    <button className="w-[24rem] mb-10 p-2 pl-3 rounded-lg bg-custom-pink text-white text-lg font-semibold">Copy</button>
                    </div>
            
            <div className="w-[50vw] h-[40vh] mx-auto p-8 rounded-lg  font-body bg-custom-blue">
                <h1 className="text-2xl text-white">In Room</h1>
                <div className="flex mt-10 gap-8">
                {                   
                    users.map((user,i ) => {
                        return (
                            <div key={i} className="flex flex-col gap-2">
                                <img src={user.avatar} className="h-[5rem]" alt="" />
                                <h3 className="text-sm text-white self-center"> { user.name}</h3>

                            </div>
                        )
                        
                    })
                    }
                </div>
                
          


            </div>
            <button onClick={handleStartClicked} className="w-[50%] p-4 mt-9 bg-emerald-500 rounded-sm text-xl font-semibold text-white">START!</button>

            </div>
            </div >
            </div>): <MainCanvasPage />
    )
}
export default InRoom