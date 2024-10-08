import left from "../assets/left.png"
import right from "../assets/right.png"
import character from "../assets/character.png"
import character1 from "../assets/character1.png"
import wizard from "../assets/wizard.png"
import faun from "../assets/faun.png"
import { useState } from "react"

const AvatarSelect = ({handleButtonClick}) => {
    const avatars = [character, character1, wizard, faun]
    const [currentAvatar, setCurrentAvatar] = useState(0)
   
    const handleLeftClick = () => {
        setCurrentAvatar(prev => (prev > 0 ? prev - 1 : prev))
    }
    
    const handleRightClick = () => {
        setCurrentAvatar(prev => (prev < avatars.length - 1 ? prev + 1 : prev))
    }

    return (
        <div className="h-[65vh] w-[50vw]  bg-custom-blue pt-5 flex flex-col font-body rounded-lg">
            <input type="text" placeholder="Enter Your Name" className="w-[85%] self-center rounded-lg p-3 text-center text-gray-800 font-extrabold text-2xl focus:outline-none mt-5" />
            <div className="flex gap-4 mt-8 mx-2 items-center justify-center">
                <img src={left} className="h-20 cursor-pointer" onClick={handleLeftClick} alt="Left arrow" />
                <img src={avatars[currentAvatar]} className="h-[10rem]" alt="Selected avatar" />
                <img src={right} className="h-20 cursor-pointer" onClick={handleRightClick} alt="Right arrow" />
            </div>
            <button onClick={handleButtonClick} className="w-[85%] self-center bg-emerald-500 text-white rounded-md text-2xl font-extrabold p-2 mt-8">
                Create Private Room!
            </button>
            <div className="flex gap-2 items-center justify-center mt-6">
                <input className="w-[49%] p-2 rounded-md focus:outline-none" placeholder="Enter Room Id" />
                <button className="bg-custom-pink w-[35%] text-white rounded-md p-2">
                    Enter Room
                </button>
                    
            </div>
        </div>
    )
}

export default AvatarSelect;